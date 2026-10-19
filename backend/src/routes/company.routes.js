const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const {
  getVehicleTypes,
  getMyCompany,
  saveCompany,
  subscribePlan,
  getProjects,
  createProject,
  getProjectDetails,
  exportProjectOrdersCSV,
} = require('../controllers/company.controller');

const router = express.Router();

// Catalogue des types de véhicules et engins (ouvert à tous les utilisateurs authentifiés)
router.get('/vehicle-types', authenticate, getVehicleTypes);

// Profil Entreprise B2B (clients authentifiés)
router.get('/my-company', authenticate, requireRole('client'), getMyCompany);
router.post('/my-company', authenticate, requireRole('client'), [
  body('name').trim().notEmpty().withMessage('Nom d\'entreprise requis'),
  body('ifu').optional({ nullable: true }).trim(),
  body('address').optional({ nullable: true }).trim(),
  body('phone').optional({ nullable: true }).trim(),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email invalide'),
], validateRequest, saveCompany);

// Souscription Abonnement SaaS / Pack Chantier
router.post('/subscribe', authenticate, requireRole('client'), [
  body('plan').isIn(['monthly_saas', 'site_pack']).withMessage('Plan invalide'),
], validateRequest, subscribePlan);

// Gestion des Chantiers (Projects)
router.get('/projects', authenticate, requireRole('client'), getProjects);
router.post('/projects', authenticate, requireRole('client'), [
  body('name').trim().notEmpty().withMessage('Nom du chantier requis'),
  body('central_lat').isFloat({ min: -90, max: 90 }),
  body('central_lng').isFloat({ min: -180, max: 180 }),
  body('address').optional({ nullable: true }).trim(),
], validateRequest, createProject);

router.get('/projects/:id', authenticate, requireRole('client'), [
  param('id').isUUID(),
], validateRequest, getProjectDetails);

// Export CSV des courses d'un chantier
router.get('/projects/:id/export-csv', authenticate, requireRole('client'), [
  param('id').isUUID(),
], validateRequest, exportProjectOrdersCSV);

module.exports = router;
