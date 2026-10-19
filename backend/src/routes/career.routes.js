const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { query } = require('../config/database');

const router = express.Router();

// =============================================
// PUBLIC — Offres d'emploi
// =============================================

// GET /api/careers — liste des offres actives (public, sans auth)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, description, location, contract_type, requirements,
              salary_range, is_active, created_at
       FROM careers
       WHERE is_active = true
       ORDER BY created_at DESC`
    );
    res.json({ careers: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/careers/:id/apply — postuler (public, sans auth)
router.post('/:id/apply', [
  param('id').isUUID(),
  body('full_name').trim().notEmpty().withMessage('Nom complet requis'),
  body('email').isEmail().normalizeEmail().withMessage('Email valide requis'),
  body('phone').optional({ nullable: true }).isString(),
  body('cover_letter').optional({ nullable: true }).isString().isLength({ max: 2000 }),
], validateRequest, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone = null, cover_letter = null } = req.body;

    // Vérifier que l'offre existe et est active
    const careerRes = await query(
      `SELECT id, title FROM careers WHERE id = $1 AND is_active = true`,
      [id]
    );
    if (!careerRes.rows.length) {
      return res.status(404).json({ error: 'Offre d\'emploi non trouvée ou inactive' });
    }

    // Vérifier si cet email a déjà postulé pour cette offre
    const existing = await query(
      `SELECT id FROM job_applications WHERE career_id = $1 AND email = $2`,
      [id, email]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Vous avez déjà postulé pour cette offre' });
    }

    const { rows } = await query(
      `INSERT INTO job_applications (career_id, full_name, email, phone, cover_letter)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, career_id, full_name, email, phone, status, created_at`,
      [id, full_name, email, phone, cover_letter]
    );

    res.status(201).json({
      application: rows[0],
      message: `Candidature envoyée pour le poste "${careerRes.rows[0].title}"`,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// ADMIN — Gestion des offres et candidatures
// =============================================

// GET /api/admin/careers — liste toutes les offres + count candidatures
router.get('/admin', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              COUNT(ja.id) AS applications_count,
              COUNT(ja.id) FILTER (WHERE ja.status = 'pending') AS pending_count
       FROM careers c
       LEFT JOIN job_applications ja ON ja.career_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );
    res.json({ careers: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/careers — créer une offre
router.post('/admin', authenticate, requireRole('admin'), [
  body('title').trim().notEmpty().withMessage('Titre requis'),
  body('description').trim().notEmpty().withMessage('Description requise'),
  body('location').optional({ nullable: true }).isString(),
  body('contract_type').optional({ nullable: true }).isString(),
  body('requirements').optional({ nullable: true }).isString(),
  body('salary_range').optional({ nullable: true }).isString(),
  body('is_active').optional().isBoolean(),
], validateRequest, async (req, res, next) => {
  try {
    const {
      title, description, location = null, contract_type = null,
      requirements = null, salary_range = null, is_active = true,
    } = req.body;

    const { rows } = await query(
      `INSERT INTO careers (title, description, location, contract_type, requirements, salary_range, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description, location, contract_type, requirements, salary_range, is_active]
    );

    res.status(201).json({ career: rows[0], message: 'Offre créée avec succès' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/careers/:id — modifier une offre
router.patch('/admin/:id', authenticate, requireRole('admin'), [
  param('id').isUUID(),
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim().notEmpty(),
  body('location').optional({ nullable: true }).isString(),
  body('contract_type').optional({ nullable: true }).isString(),
  body('requirements').optional({ nullable: true }).isString(),
  body('salary_range').optional({ nullable: true }).isString(),
  body('is_active').optional().isBoolean(),
], validateRequest, async (req, res, next) => {
  try {
    const fields = ['title', 'description', 'location', 'contract_type', 'requirements', 'salary_range', 'is_active'];
    const updates = [];
    const params = [];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f} = $${params.length}`);
      }
    });

    if (!updates.length) return res.status(400).json({ error: 'Aucun champ à modifier' });

    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE careers SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Offre non trouvée' });
    res.json({ career: rows[0], message: 'Offre mise à jour' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/careers/:id — supprimer une offre
router.delete('/admin/:id', authenticate, requireRole('admin'), [
  param('id').isUUID(),
], validateRequest, async (req, res, next) => {
  try {
    const { rowCount } = await query(`DELETE FROM careers WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Offre non trouvée' });
    res.json({ message: 'Offre supprimée' });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/careers/:id/applications — liste des candidatures
router.get('/admin/:id/applications', authenticate, requireRole('admin'), [
  param('id').isUUID(),
], validateRequest, async (req, res, next) => {
  try {
    const careerRes = await query(`SELECT id, title FROM careers WHERE id = $1`, [req.params.id]);
    if (!careerRes.rows.length) return res.status(404).json({ error: 'Offre non trouvée' });

    const { rows } = await query(
      `SELECT * FROM job_applications WHERE career_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({ career: careerRes.rows[0], applications: rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/careers/:id/applications/:appId — mettre à jour le statut
router.patch('/admin/:id/applications/:appId', authenticate, requireRole('admin'), [
  param('id').isUUID(),
  param('appId').isUUID(),
  body('status').isIn(['pending', 'reviewing', 'accepted', 'rejected']).withMessage('Statut invalide'),
  body('admin_notes').optional({ nullable: true }).isString().isLength({ max: 1000 }),
], validateRequest, async (req, res, next) => {
  try {
    const { status, admin_notes = null } = req.body;

    const { rows } = await query(
      `UPDATE job_applications
       SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
       WHERE id = $3 AND career_id = $4
       RETURNING *`,
      [status, admin_notes, req.params.appId, req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Candidature non trouvée' });
    res.json({ application: rows[0], message: 'Statut mis à jour' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
