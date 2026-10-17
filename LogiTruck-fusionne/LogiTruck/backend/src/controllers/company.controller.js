const { query, getClient } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');
const { B2B_PRICING_PLANS } = require('../services/pricing.service');

/**
 * GET /api/vehicle-types
 * Catalogue public/authentifié des véhicules et engins de chantier
 */
const getVehicleTypes = async (req, res, next) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM vehicle_types WHERE is_active = true';
    const params = [];
    if (category) {
      sql += ' AND category = $1';
      params.push(category.toUpperCase());
    }
    sql += ' ORDER BY category, name';

    const result = await query(sql, params);
    res.json({ vehicle_types: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/companies/my-company
 * Récupère le profil de l'entreprise rattachée à l'utilisateur connecté
 */
const getMyCompany = async (req, res, next) => {
  try {
    const userResult = await query('SELECT company_id FROM users WHERE id = $1', [req.user.id]);
    const companyId = userResult.rows[0]?.company_id;

    if (!companyId) {
      return res.json({ company: null, has_company: false });
    }

    const compResult = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
    if (!compResult.rows.length) {
      return res.json({ company: null, has_company: false });
    }

    const company = compResult.rows[0];

    // Vérifier l'expiration de l'abonnement
    if (company.subscription_expires_at && new Date(company.subscription_expires_at) < new Date()) {
      if (company.subscription_status === 'active') {
        await query("UPDATE companies SET subscription_status = 'expired' WHERE id = $1", [company.id]);
        company.subscription_status = 'expired';
      }
    }

    res.json({ company, has_company: true });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/companies
 * Enregistre ou met à jour l'entreprise BTP du client
 */
const saveCompany = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { name, ifu, address, phone, email } = req.body;

    if (!name || !name.trim()) throw new AppError('Le nom de l\'entreprise est obligatoire', 400);

    const userResult = await client.query('SELECT company_id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    let companyId = userResult.rows[0]?.company_id;

    let company;
    if (companyId) {
      const updated = await client.query(
        `UPDATE companies
         SET name = $1, ifu = $2, address = $3, phone = $4, email = $5, updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [name.trim(), ifu ? ifu.trim() : null, address || null, phone || null, email || null, companyId]
      );
      company = updated.rows[0];
    } else {
      const inserted = await client.query(
        `INSERT INTO companies (name, ifu, address, phone, email, subscription_status)
         VALUES ($1, $2, $3, $4, $5, 'inactive')
         RETURNING *`,
        [name.trim(), ifu ? ifu.trim() : null, address || null, phone || null, email || null]
      );
      company = inserted.rows[0];
      await client.query('UPDATE users SET company_id = $1 WHERE id = $2', [company.id, req.user.id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Entreprise enregistrée avec succès', company });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * POST /api/companies/subscribe
 * Souscription à un plan B2B (Abonnement mensuel SaaS 45 000 FCFA ou Pack Chantier 75 000 FCFA)
 */
const subscribePlan = async (req, res, next) => {
  try {
    const { plan = 'monthly_saas', payment_reference = null } = req.body;
    const planConfig = B2B_PRICING_PLANS[plan];
    if (!planConfig) {
      throw new AppError('Formule d\'abonnement invalide. Choisissez "monthly_saas" ou "site_pack"', 400);
    }

    const userResult = await query('SELECT company_id FROM users WHERE id = $1', [req.user.id]);
    const companyId = userResult.rows[0]?.company_id;
    if (!companyId) {
      throw new AppError('Vous devez d\'abord enregistrer le profil de votre entreprise', 400);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + planConfig.duration_days);

    const result = await query(
      `UPDATE companies
       SET subscription_status = 'active',
           subscription_plan = $1,
           subscription_price = $2,
           subscription_started_at = NOW(),
           subscription_expires_at = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [plan, planConfig.price, expiresAt, companyId]
    );

    res.json({
      message: `Abonnement B2B "${planConfig.name}" activé avec succès !`,
      company: result.rows[0],
      plan: planConfig,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/companies/projects
 * Liste des chantiers rattachés à l'entreprise
 */
const getProjects = async (req, res, next) => {
  try {
    const userResult = await query('SELECT company_id FROM users WHERE id = $1', [req.user.id]);
    const companyId = userResult.rows[0]?.company_id;
    if (!companyId) {
      return res.json({ projects: [] });
    }

    const result = await query(
      `SELECT p.*,
              COUNT(o.id) AS total_orders,
              COUNT(o.id) FILTER (WHERE o.status = 'completed') AS completed_orders,
              COUNT(o.id) FILTER (WHERE o.status = 'delivered') AS delivered_orders,
              COUNT(o.id) FILTER (WHERE o.status IN ('accepted', 'loading', 'driver_en_route_delivery', 'machine_operating', 'dumping')) AS active_orders,
              COALESCE(SUM(o.quantity_m3) FILTER (WHERE o.status = 'completed'), 0) AS total_volume_delivered_m3,
              COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status IN ('escrow_held', 'payout_pending', 'released')), 0) AS total_budget_spent
       FROM projects_chantiers p
       LEFT JOIN orders o ON o.project_id = p.id
       WHERE p.company_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [companyId]
    );

    res.json({ projects: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/companies/projects
 * Création d'un nouveau chantier
 */
const createProject = async (req, res, next) => {
  try {
    const { name, address, central_lat, central_lng, contact_name, contact_phone } = req.body;

    if (!name || !name.trim()) throw new AppError('Le nom du chantier est obligatoire', 400);
    if (central_lat === undefined || central_lng === undefined) {
      throw new AppError('Les coordonnées GPS du chantier sont obligatoires', 400);
    }

    const userResult = await query('SELECT company_id FROM users WHERE id = $1', [req.user.id]);
    const companyId = userResult.rows[0]?.company_id;
    if (!companyId) {
      throw new AppError('Veuillez d\'abord renseigner le nom de votre entreprise', 400);
    }

    const result = await query(
      `INSERT INTO projects_chantiers (
        company_id, name, address, central_lat, central_lng, contact_name, contact_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        companyId,
        name.trim(),
        address || null,
        parseFloat(central_lat),
        parseFloat(central_lng),
        contact_name || null,
        contact_phone || null,
      ]
    );

    res.status(201).json({ message: 'Chantier créé avec succès', project: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/companies/projects/:id
 * Détail d'un chantier avec ses commandes associées
 */
const getProjectDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const projectResult = await query('SELECT * FROM projects_chantiers WHERE id = $1', [id]);
    if (!projectResult.rows.length) throw new AppError('Chantier introuvable', 404);

    const project = projectResult.rows[0];

    const ordersResult = await query(
      `SELECT o.*,
              u_driver.full_name AS driver_name, u_driver.phone AS driver_phone,
              mt.name AS material_name, vt.name AS vehicle_name
       FROM orders o
       LEFT JOIN users u_driver ON u_driver.id = o.driver_id
       LEFT JOIN material_types mt ON mt.id = o.material_type_id
       LEFT JOIN vehicle_types vt ON vt.id = o.vehicle_type_id
       WHERE o.project_id = $1
       ORDER BY o.created_at DESC`,
      [id]
    );

    res.json({ project, orders: ordersResult.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/companies/projects/:id/export-csv
 * Export des commandes et reçus d'un chantier en format CSV (fonctionnalité B2B)
 */
const exportProjectOrdersCSV = async (req, res, next) => {
  try {
    const { id } = req.params;
    const projectResult = await query('SELECT name FROM projects_chantiers WHERE id = $1', [id]);
    if (!projectResult.rows.length) throw new AppError('Chantier introuvable', 404);

    const projectName = projectResult.rows[0].name.replace(/[^a-zA-Z0-9_-]/g, '_');

    const ordersResult = await query(
      `SELECT o.order_number, o.order_type, o.status, o.payment_status,
              o.pickup_address, o.delivery_address,
              COALESCE(mt.name, o.material_description, vt.name, 'N/A') AS designation,
              o.quantity_m3, o.duration_hours,
              o.distance_km, o.total_amount, o.driver_amount, o.commission_amount,
              u_d.full_name AS chauffeur, o.created_at, o.delivered_at
       FROM orders o
       LEFT JOIN material_types mt ON mt.id = o.material_type_id
       LEFT JOIN vehicle_types vt ON vt.id = o.vehicle_type_id
       LEFT JOIN users u_d ON u_d.id = o.driver_id
       WHERE o.project_id = $1
       ORDER BY o.created_at ASC`,
      [id]
    );

    const rows = ordersResult.rows;
    const header = [
      'N° Commande',
      'Type Service',
      'Statut',
      'Statut Paiement',
      'Départ (Carrière/Site)',
      'Arrivée (Chantier)',
      'Désignation / Matériau',
      'Quantité (m³)',
      'Durée (Heures)',
      'Distance (km)',
      'Montant Total (FCFA)',
      'Part Chauffeur (FCFA)',
      'Commission Séquestre (FCFA)',
      'Chauffeur Assigné',
      'Date Création',
      'Date Livraison',
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvLines = [header.map(escapeCsv).join(';')];

    for (const r of rows) {
      csvLines.push([
        r.order_number,
        r.order_type,
        r.status,
        r.payment_status,
        r.pickup_address,
        r.delivery_address,
        r.designation,
        r.quantity_m3 || '',
        r.duration_hours || '',
        r.distance_km || '',
        r.total_amount,
        r.driver_amount,
        r.commission_amount,
        r.chauffeur || 'Non assigné',
        r.created_at ? new Date(r.created_at).toISOString() : '',
        r.delivered_at ? new Date(r.delivered_at).toISOString() : '',
      ].map(escapeCsv).join(';'));
    }

    const csvContent = '\uFEFF' + csvLines.join('\r\n'); // BOM UTF-8 pour Excel

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="LogiTruck_${projectName}_rapport.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVehicleTypes,
  getMyCompany,
  saveCompany,
  subscribePlan,
  getProjects,
  createProject,
  getProjectDetails,
  exportProjectOrdersCSV,
};
