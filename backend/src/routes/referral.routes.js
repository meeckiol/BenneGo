const express = require('express');
const { body } = require('express-validator');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { query } = require('../config/database');

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

// GET /api/referrals/me — voir son code + stats
router.get('/me', authenticate, requireRole(['client', 'driver']), async (req, res, next) => {
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

    // Stats : nb de filleuls et total récompenses
    const statsRes = await query(
      `SELECT
         COUNT(*) AS total_referrals,
         COUNT(*) FILTER (WHERE status = 'rewarded') AS rewarded_count,
         COALESCE(SUM(reward_amount) FILTER (WHERE status = 'rewarded'), 0) AS total_rewards
       FROM referrals
       WHERE referrer_id = $1`,
      [req.user.id]
    );

    const stats = statsRes.rows[0];

    res.json({
      referral_code,
      total_referrals: parseInt(stats.total_referrals, 10),
      rewarded_count: parseInt(stats.rewarded_count, 10),
      total_rewards: parseFloat(stats.total_rewards),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// CLIENT / DRIVER — Utiliser un code parrain
// =============================================

// POST /api/referrals — l'utilisateur connecté devient filleul (referee)
router.post('/', authenticate, requireRole(['client', 'driver']), [
  body('referral_code').trim().notEmpty().withMessage('Code de parrainage requis'),
], validateRequest, async (req, res, next) => {
  try {
    const { referral_code } = req.body;

    // Vérifier que l'utilisateur n'est pas déjà filleul
    const existingReferral = await query(
      `SELECT id FROM referrals WHERE referee_id = $1`,
      [req.user.id]
    );
    if (existingReferral.rows.length) {
      return res.status(409).json({ error: 'Vous avez déjà utilisé un code de parrainage' });
    }

    // Trouver le parrain via son referral_code
    const referrerRes = await query(
      `SELECT id FROM users WHERE referral_code = UPPER($1) AND is_active = true`,
      [referral_code]
    );

    if (!referrerRes.rows.length) {
      return res.status(404).json({ error: 'Code de parrainage invalide ou inexistant' });
    }

    const referrer_id = referrerRes.rows[0].id;

    if (referrer_id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous parrainer vous-même' });
    }

    const { rows } = await query(
      `INSERT INTO referrals (referrer_id, referee_id, referral_code, reward_amount, status)
       VALUES ($1, $2, UPPER($3), 2500, 'pending')
       RETURNING *`,
      [referrer_id, req.user.id, referral_code]
    );

    res.status(201).json({
      referral: rows[0],
      message: 'Code de parrainage enregistré avec succès',
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ce parrainage a déjà été enregistré' });
    }
    next(error);
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
