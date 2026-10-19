const { query, getClient } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

/**
 * POST /api/reviews/orders/:orderId/driver   (client)
 * Note de 1 à 5 étoiles + avis sur le chauffeur, possible uniquement après confirmation
 * de la réception, une seule fois par commande.
 */
const reviewDriver = async (req, res, next) => {
  const db = await getClient();
  try {
    const rating = Number(req.body.rating);
    const comment = (req.body.comment || '').trim() || null;

    await db.query('BEGIN');
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.orderId]);
    if (!rows.length) throw new AppError('Commande introuvable', 404);
    const order = rows[0];

    if (order.client_id !== req.user.id) throw new AppError('Accès refusé', 403);
    if (!['validated', 'completed'].includes(order.status)) {
      throw new AppError('Vous pourrez noter le chauffeur après avoir confirmé la réception', 409);
    }
    if (order.client_rating) throw new AppError('Vous avez déjà noté cette course', 409);

    await db.query(
      'UPDATE orders SET client_rating = $1, client_review = $2, rated_at = NOW(), updated_at = NOW() WHERE id = $3',
      [rating, comment, order.id]
    );
    // Moyenne recalculée depuis les notes réelles (pas d'approximation incrémentale)
    const agg = await db.query(
      `UPDATE driver_profiles dp SET
         rating = s.avg_rating, rating_count = s.cnt, updated_at = NOW()
       FROM (SELECT ROUND(AVG(client_rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS cnt
             FROM orders WHERE driver_id = $1 AND client_rating IS NOT NULL) s
       WHERE dp.user_id = $1
       RETURNING dp.rating, dp.rating_count`,
      [order.driver_id]
    );
    await db.query('COMMIT');

    res.status(201).json({
      message: 'Merci pour votre avis !',
      driver_rating: Number(agg.rows[0].rating),
      driver_rating_count: agg.rows[0].rating_count,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  } finally {
    db.release();
  }
};

/**
 * POST /api/reviews/platform   (client)
 * Avis (et note facultative) sur la plateforme LogiTruck. `order_id` facultatif :
 * s'il est fourni il doit s'agir d'une commande du client (un avis plateforme par commande).
 */
const reviewPlatform = async (req, res, next) => {
  try {
    const { order_id } = req.body;
    const rating = req.body.rating ? Number(req.body.rating) : null;
    const comment = req.body.comment.trim();

    if (order_id) {
      const own = await query('SELECT 1 FROM orders WHERE id = $1 AND client_id = $2', [order_id, req.user.id]);
      if (!own.rows.length) throw new AppError('Commande introuvable', 404);
    }
    await query(
      'INSERT INTO platform_reviews (user_id, order_id, rating, comment) VALUES ($1, $2, $3, $4)',
      [req.user.id, order_id || null, rating, comment]
    );
    res.status(201).json({ message: 'Merci, votre avis sur la plateforme a bien été enregistré.' });
  } catch (error) {
    if (error.code === '23505') return next(new AppError('Vous avez déjà donné votre avis pour cette commande', 409));
    next(error);
  }
};

/** GET /api/reviews/drivers/:driverId — note moyenne + derniers avis (prénom du client uniquement) */
const getDriverReviews = async (req, res, next) => {
  try {
    const profile = await query(
      'SELECT rating, rating_count, total_trips FROM driver_profiles WHERE user_id = $1',
      [req.params.driverId]
    );
    if (!profile.rows.length) throw new AppError('Chauffeur introuvable', 404);

    const reviews = await query(
      `SELECT o.client_rating AS rating, o.client_review AS comment, o.rated_at,
              split_part(u.full_name, ' ', 1) AS client_first_name
       FROM orders o JOIN users u ON u.id = o.client_id
       WHERE o.driver_id = $1 AND o.client_rating IS NOT NULL
       ORDER BY o.rated_at DESC LIMIT 50`,
      [req.params.driverId]
    );
    const p = profile.rows[0];
    res.json({
      rating: p.rating === null ? null : Number(p.rating),
      rating_count: p.rating_count,
      total_trips: p.total_trips,
      reviews: reviews.rows,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { reviewDriver, reviewPlatform, getDriverReviews };
