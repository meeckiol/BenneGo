const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { query, getClient } = require('../config/database');
const referralService = require('../services/referral.service');
const push = require('../services/push.service');

const router = express.Router();

// Générer un code de parrainage unique (6 chars uppercase alphanumérique)
const generateReferralCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const { rows } = await query(`SELECT id FROM users WHERE referral_code = $1`, [code]);
    if (!rows.length) isUnique = true;
    attempts++;
  }

  return code;
};

// =============================================
// CLIENT / DRIVER — Mon code de parrainage
// =============================================

// GET /api/referrals/me — code, primes, crédit BenneGo, filleuls et avantage reçu comme filleul
router.get('/me', authenticate, requireRole('client', 'driver'), async (req, res, next) => {
  try {
    let userRes = await query(`SELECT referral_code FROM users WHERE id = $1`, [req.user.id]);
    let referral_code = userRes.rows[0]?.referral_code;

    // Générer un code si l'utilisateur n'en a pas
    if (!referral_code) {
      referral_code = await generateReferralCode();
      await query(
        `UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2`,
        [referral_code, req.user.id]
      );
    }

    const [referees, credit, welcome, canApply, payouts] = await Promise.all([
      referralService.listReferees(req.user.id),
      referralService.creditBalance(req.user.id),
      referralService.welcomeFor(req.user.id),
      referralService.hasNotStarted(req.user),
      req.user.role === 'driver'
        ? query(
          `SELECT id, amount, status, requested_at, processed_at FROM credit_payouts
           WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 10`,
          [req.user.id]
        ).then((r) => r.rows)
        : Promise.resolve([]),
    ]);
    const rewarded = referees.filter((r) => r.status === 'rewarded');

    res.json({
      referral_code,
      total_referrals: referees.length,
      rewarded_count: rewarded.length,
      total_rewards: rewarded.reduce((sum, r) => sum + r.reward, 0),
      credit_balance: credit,
      referees,
      // Primes selon le type de compte du filleul, pour les textes de l'application
      rewards: {
        same_type: referralService.rewardsFor(req.user.role, req.user.role),
        cross_type: referralService.rewardsFor(req.user.role, req.user.role === 'client' ? 'driver' : 'client'),
      },
      welcome,
      can_apply_code: !welcome && canApply,
      min_payout: referralService.MIN_PAYOUT,
      payouts,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// CLIENT / DRIVER — Utiliser un code parrain (avant la 1re commande ou course)
// =============================================

// POST /api/referrals — l'utilisateur connecté devient filleul (referee)
router.post('/', authenticate, requireRole('client', 'driver'), [
  body('referral_code').trim().notEmpty().withMessage('Code de parrainage requis'),
], validateRequest, async (req, res, next) => {
  try {
    const referral = await referralService.applyCode(req.user, req.body.referral_code);
    res.status(201).json({
      referral,
      message: referral.referee_reward > 0
        ? (req.user.role === 'client'
          ? `Code enregistré : ${referral.referee_reward} FCFA de réduction sur votre première commande.`
          : `Code enregistré : ${referral.referee_reward} FCFA de bonus à votre première course livrée.`)
        : 'Code de parrainage enregistré.',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/referrals/credit/payout — le camionneur demande le versement de son crédit sur son Mobile Money
router.post('/credit/payout', authenticate, requireRole('driver'), async (req, res, next) => {
  const db = await getClient();
  try {
    await db.query('BEGIN');
    const payout = await referralService.requestPayout(db, req.user);
    await db.query('COMMIT');
    push.sendToAdmins({
      title: 'Demande de versement',
      body: `${req.user.full_name} demande le versement de ${Math.round(Number(payout.amount)).toLocaleString('fr-FR')} FCFA de crédit.`,
      tag: `credit-payout-${payout.id}`,
      url: '/referrals',
    }, { category: 'payouts' }).catch(() => null);
    res.status(201).json({ payout, message: 'Demande envoyée : BenneGo vous verse le montant sur votre Mobile Money.' });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  } finally {
    db.release();
  }
});

// GET /api/referrals/admin/payouts — demandes de versement du crédit (admin)
router.get('/admin/payouts', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.full_name, u.phone FROM credit_payouts p JOIN users u ON u.id = p.user_id
       ORDER BY (p.status = 'requested') DESC, p.requested_at DESC LIMIT 200`
    );
    res.json({ payouts: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/referrals/admin/payouts/:id — { decision: 'paid' | 'rejected', reference }
router.post('/admin/payouts/:id', authenticate, requireRole('admin'), [
  param('id').isUUID(),
  body('decision').isIn(['paid', 'rejected']).withMessage('Décision invalide (paid ou rejected)'),
  body('reference').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
], validateRequest, async (req, res, next) => {
  const db = await getClient();
  try {
    await db.query('BEGIN');
    const payout = await referralService.processPayout(db, req.params.id, req.user, req.body);
    await db.query('COMMIT');
    res.json({ payout });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  } finally {
    db.release();
  }
});

// =============================================
// ADMIN — Liste de tous les parrainages
// =============================================

// GET /api/admin/referrals — liste tous les parrainages avec noms
router.get('/admin', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT r.*,
              u_referrer.full_name AS referrer_name,
              u_referrer.phone AS referrer_phone,
              u_referee.full_name AS referee_name,
              u_referee.phone AS referee_phone
       FROM referrals r
       JOIN users u_referrer ON u_referrer.id = r.referrer_id
       JOIN users u_referee ON u_referee.id = r.referee_id
       ORDER BY r.created_at DESC
       LIMIT 500`
    );
    res.json({ referrals: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
