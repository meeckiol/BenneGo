const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

/**
 * Parrainage BenneGo.
 * - Même type de compte (client → client, camionneur → camionneur) : 1 500 FCFA au parrain, 1 500 FCFA au filleul.
 * - Croisé (client → camionneur, camionneur → client) : 1 000 FCFA au parrain, rien au filleul.
 * - Le parrain gagne sa prime quand la 1re commande du filleul client, ou la 1re course du filleul camionneur,
 *   est livrée et confirmée. Il la reçoit en crédit BenneGo.
 * - Filleul client : 1 500 FCFA de réduction appliqués d'office sur sa 1re commande.
 *   Filleul camionneur : 1 500 FCFA ajoutés à son crédit à sa 1re course livrée et confirmée.
 * - Le code parrain se saisit à l'inscription ou avant la 1re commande / course, plus après.
 * - Crédit : le client choisit de l'utiliser sur une commande ; le camionneur en demande le versement Mobile Money.
 */
const REWARDS = {
  sameType: { referrer: 1500, referee: 1500 },
  crossType: { referrer: 1000, referee: 0 },
};

// Le client paie toujours au moins ce montant (le paiement en ligne refuse un montant nul)
const MIN_PAYABLE = 200;
// Versement minimum demandé par un camionneur
const MIN_PAYOUT = 500;

const rewardsFor = (referrerRole, refereeRole) => (referrerRole === refereeRole ? REWARDS.sameType : REWARDS.crossType);

const money = (n) => Math.round(Number(n) || 0);

/** Solde du crédit BenneGo (somme des mouvements). `db` : client de transaction facultatif. */
const creditBalance = async (userId, db = { query }) => {
  const { rows } = await db.query('SELECT COALESCE(SUM(amount), 0) AS balance FROM user_credits WHERE user_id = $1', [userId]);
  return money(rows[0].balance);
};

/** Vrai tant que l'utilisateur n'a encore ni payé de commande (client) ni accepté de course (camionneur). */
const hasNotStarted = async (user, db = { query }) => {
  const sql = user.role === 'driver'
    ? 'SELECT 1 FROM orders WHERE driver_id = $1 LIMIT 1'
    : "SELECT 1 FROM orders WHERE client_id = $1 AND payment_status <> 'unpaid' AND status <> 'cancelled' LIMIT 1";
  const { rows } = await db.query(sql, [user.id]);
  return rows.length === 0;
};

/** Enregistre le code d'un parrain pour l'utilisateur (filleul). */
const applyCode = async (user, rawCode, db = { query }) => {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) throw new AppError('Code de parrainage requis', 400);
  if (!['client', 'driver'].includes(user.role)) throw new AppError('Parrainage réservé aux clients et camionneurs', 403);

  const existing = await db.query('SELECT id FROM referrals WHERE referee_id = $1', [user.id]);
  if (existing.rows.length) throw new AppError('Vous avez déjà utilisé un code de parrainage', 409);

  if (!(await hasNotStarted(user, db))) {
    throw new AppError(
      user.role === 'driver'
        ? 'Le code parrain se saisit avant votre première course'
        : 'Le code parrain se saisit avant votre première commande',
      409
    );
  }

  const referrer = await db.query(
    "SELECT id, role FROM users WHERE referral_code = $1 AND is_active = true AND role IN ('client', 'driver')",
    [code]
  );
  if (!referrer.rows.length) throw new AppError('Code de parrainage invalide ou inexistant', 404);
  const { id: referrerId, role: referrerRole } = referrer.rows[0];
  if (referrerId === user.id) throw new AppError('Vous ne pouvez pas vous parrainer vous-même', 400);

  const reward = rewardsFor(referrerRole, user.role);
  try {
    const { rows } = await db.query(
      `INSERT INTO referrals (referrer_id, referee_id, referral_code, reward_amount, referee_reward, referrer_role, referee_role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [referrerId, user.id, code, reward.referrer, reward.referee, referrerRole, user.role]
    );
    await db.query('UPDATE users SET referred_by = $1 WHERE id = $2', [referrerId, user.id]);
    return rows[0];
  } catch (error) {
    if (error.code === '23505') throw new AppError('Vous avez déjà utilisé un code de parrainage', 409);
    throw error;
  }
};

/**
 * Réductions d'une commande client : 1 500 FCFA de bienvenue sur la 1re commande d'un filleul (même type),
 * puis le crédit BenneGo si le client choisit de l'utiliser. Plafond : la commission BenneGo (la part du
 * chauffeur ne baisse jamais) et un montant minimal à payer.
 */
const orderDiscounts = async (db, user, { total, commission, useCredit, release = false }) => {
  const result = { referralDiscount: 0, creditUsed: 0, referralId: null, creditBalance: 0 };
  if (user.role !== 'client') return result;
  if (release) await releaseUnpaidReservations(db, user.id);
  let room = Math.max(0, Math.min(money(commission), money(total) - MIN_PAYABLE));

  const welcome = await db.query(
    `SELECT id, referee_reward FROM referrals
     WHERE referee_id = $1 AND status = 'pending' AND referee_reward > 0 AND welcome_order_id IS NULL`,
    [user.id]
  );
  if (welcome.rows.length && (await hasNotStarted(user, db))) {
    result.referralDiscount = Math.min(money(welcome.rows[0].referee_reward), room);
    result.referralId = welcome.rows[0].id;
    room -= result.referralDiscount;
  }

  result.creditBalance = await creditBalance(user.id, db);
  if (useCredit) result.creditUsed = Math.min(result.creditBalance, room);
  return result;
};

/**
 * Commandes jamais payées : leurs réductions sont libérées quand le client en crée une nouvelle,
 * pour que le crédit et la réduction de bienvenue ne restent pas bloqués. Si l'ancienne est payée ensuite, c'est au prix plein.
 */
const releaseUnpaidReservations = async (db, userId) => {
  const { rows } = await db.query(
    `SELECT id, client_id, credit_used FROM orders
     WHERE client_id = $1 AND status = 'awaiting_payment' AND payment_status = 'unpaid' AND discount_amount > 0
     FOR UPDATE`,
    [userId]
  );
  for (const order of rows) {
    await releaseForOrder(db, order);
    await db.query('UPDATE orders SET referral_discount = 0, credit_used = 0, discount_amount = 0 WHERE id = $1', [order.id]);
  }
};

/** Réserve les réductions sur la commande créée (même transaction que la création). */
const reserveForOrder = async (db, orderId, userId, discounts) => {
  if (discounts.referralId && discounts.referralDiscount > 0) {
    await db.query('UPDATE referrals SET welcome_order_id = $1 WHERE id = $2', [orderId, discounts.referralId]);
  }
  if (discounts.creditUsed > 0) {
    await db.query(
      "INSERT INTO user_credits (user_id, amount, reason, order_id) VALUES ($1, $2, 'used_on_order', $3)",
      [userId, -discounts.creditUsed, orderId]
    );
  }
};

/** Commande annulée ou remboursée : le crédit utilisé revient et la réduction de bienvenue redevient disponible. */
const releaseForOrder = async (db, order) => {
  if (money(order.credit_used) > 0) {
    await db.query(
      "INSERT INTO user_credits (user_id, amount, reason, order_id) VALUES ($1, $2, 'order_cancelled', $3)",
      [order.client_id, money(order.credit_used), order.id]
    );
  }
  await db.query('UPDATE referrals SET welcome_order_id = NULL WHERE welcome_order_id = $1', [order.id]);
};

const rewardReferral = async (db, referral, orderId) => {
  const updated = await db.query(
    `UPDATE referrals SET status = 'rewarded', rewarded_at = NOW(), qualifying_order_id = $2
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [referral.id, orderId]
  );
  if (!updated.rows.length) return;
  if (money(referral.reward_amount) > 0) {
    await db.query(
      `INSERT INTO user_credits (user_id, amount, reason, order_id, referral_id)
       VALUES ($1, $2, 'referral_reward', $3, $4) ON CONFLICT DO NOTHING`,
      [referral.referrer_id, money(referral.reward_amount), orderId, referral.id]
    );
  }
  // Filleul camionneur (même type) : sa prime de bienvenue arrive avec sa 1re course
  if (referral.referee_role === 'driver' && money(referral.referee_reward) > 0) {
    await db.query(
      `INSERT INTO user_credits (user_id, amount, reason, order_id, referral_id)
       VALUES ($1, $2, 'referral_welcome', $3, $4) ON CONFLICT DO NOTHING`,
      [referral.referee_id, money(referral.referee_reward), orderId, referral.id]
    );
  }
};

/**
 * Commande livrée et confirmée (même transaction) : si c'est la 1re du client ou la 1re course du camionneur,
 * leur parrain gagne sa prime.
 */
const onOrderValidated = async (db, order) => {
  const pending = await db.query(
    "SELECT * FROM referrals WHERE status = 'pending' AND referee_id = ANY($1)",
    [[order.client_id, order.driver_id].filter(Boolean)]
  );
  for (const referral of pending.rows) {
    const asDriver = referral.referee_id === order.driver_id;
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM orders
       WHERE ${asDriver ? 'driver_id' : 'client_id'} = $1 AND status IN ('validated', 'completed')`,
      [referral.referee_id]
    );
    if (rows[0].n <= 1) await rewardReferral(db, referral, order.id);
  }
};

/** Prénom et initiale du nom : le parrain voit qui il a invité, sans les coordonnées complètes. */
const shortName = (fullName = '') => {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.pop();
  return last ? `${first} ${last[0].toUpperCase()}.` : first || 'Filleul';
};

/** Filleuls du parrain avec l'état de leur prime. */
const listReferees = async (referrerId) => {
  const { rows } = await query(
    `SELECT r.id, r.status, r.reward_amount, r.referee_role, r.created_at, r.rewarded_at, u.full_name
     FROM referrals r JOIN users u ON u.id = r.referee_id
     WHERE r.referrer_id = $1 ORDER BY r.created_at DESC`,
    [referrerId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: shortName(r.full_name),
    role: r.referee_role,
    status: r.status,
    reward: money(r.reward_amount),
    created_at: r.created_at,
    rewarded_at: r.rewarded_at,
  }));
};

/** Ce que le filleul a reçu ou va recevoir grâce à son parrain. */
const welcomeFor = async (userId) => {
  const { rows } = await query(
    `SELECT r.status, r.referee_reward, r.welcome_order_id, u.full_name AS referrer_name
     FROM referrals r JOIN users u ON u.id = r.referrer_id WHERE r.referee_id = $1`,
    [userId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    referrer: shortName(r.referrer_name),
    amount: money(r.referee_reward),
    status: r.status,
    reserved_on_order: r.welcome_order_id,
  };
};

/** Le camionneur demande le versement de son crédit sur son Mobile Money. */
const requestPayout = async (db, user) => {
  if (user.role !== 'driver') throw new AppError('Le versement du crédit est réservé aux camionneurs', 403);
  const balance = await creditBalance(user.id, db);
  if (balance < MIN_PAYOUT) throw new AppError(`Versement possible à partir de ${MIN_PAYOUT} FCFA de crédit`, 400);
  const open = await db.query("SELECT 1 FROM credit_payouts WHERE user_id = $1 AND status = 'requested'", [user.id]);
  if (open.rows.length) throw new AppError('Une demande de versement est déjà en cours', 409);
  const momo = await db.query('SELECT momo_number, momo_provider FROM driver_profiles WHERE user_id = $1', [user.id]);
  if (!momo.rows[0]?.momo_number) throw new AppError('Numéro Mobile Money manquant : contactez l\'assistance', 400);
  const { rows } = await db.query(
    `INSERT INTO credit_payouts (user_id, amount, momo_number, momo_provider) VALUES ($1, $2, $3, $4) RETURNING *`,
    [user.id, balance, momo.rows[0].momo_number, momo.rows[0].momo_provider]
  );
  await db.query(
    "INSERT INTO user_credits (user_id, amount, reason, payout_id) VALUES ($1, $2, 'payout_requested', $3)",
    [user.id, -balance, rows[0].id]
  );
  return rows[0];
};

/** L'administration marque un versement comme fait, ou le refuse (le crédit revient alors au camionneur). */
const processPayout = async (db, payoutId, admin, { decision, reference }) => {
  const { rows } = await db.query("SELECT * FROM credit_payouts WHERE id = $1 AND status = 'requested' FOR UPDATE", [payoutId]);
  if (!rows.length) throw new AppError('Demande introuvable ou déjà traitée', 404);
  const payout = rows[0];
  const status = decision === 'paid' ? 'paid' : 'rejected';
  await db.query(
    'UPDATE credit_payouts SET status = $2, reference = $3, processed_at = NOW(), processed_by = $4 WHERE id = $1',
    [payout.id, status, reference || null, admin.id]
  );
  if (status === 'rejected') {
    await db.query(
      "INSERT INTO user_credits (user_id, amount, reason, payout_id) VALUES ($1, $2, 'payout_rejected', $3)",
      [payout.user_id, money(payout.amount), payout.id]
    );
  }
  return { ...payout, status };
};

module.exports = {
  REWARDS, MIN_PAYABLE, MIN_PAYOUT,
  rewardsFor, creditBalance, hasNotStarted, applyCode,
  orderDiscounts, reserveForOrder, releaseForOrder, onOrderValidated,
  listReferees, welcomeFor, requestPayout, processPayout,
};
