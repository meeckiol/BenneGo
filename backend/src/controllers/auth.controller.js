const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

/**
 * Génère un numéro de commande unique
 */
const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `LT-${year}-${random}`;
};

/**
 * Génère un token JWT
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /api/auth/register
 * Inscription d'un nouveau client ou chauffeur
 * Champs obligatoires : phone, prenom, nom, date_naissance, adresse, password
 * Champs optionnels  : email, role (défaut: client)
 */
const register = async (req, res, next) => {
  try {
    const {
      phone,
      prenom,
      nom,
      date_naissance,
      adresse,
      email,
      password,
      role = 'client',
    } = req.body;

    // Validation du rôle (on ne peut pas s'inscrire comme admin)
    if (!['client', 'driver'].includes(role)) {
      throw new AppError('Rôle invalide', 400);
    }

    // Construire le full_name à partir de prenom + nom
    const full_name = `${prenom.trim()} ${nom.trim()}`;

    // Vérifier si le numéro existe déjà
    const existing = await query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );
    if (existing.rows.length > 0) {
      throw new AppError('Ce numéro de téléphone est déjà enregistré', 409);
    }

    // Hacher le mot de passe
    const password_hash = await bcrypt.hash(password, 12);

    // Créer l'utilisateur avec tous les champs profil
    const result = await query(
      `INSERT INTO users (phone, full_name, prenom, nom, date_naissance, adresse, email, role, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, phone, full_name, prenom, nom, date_naissance, adresse, email, role, created_at`,
      [phone, full_name, prenom.trim(), nom.trim(), date_naissance || null, adresse || null, email || null, role, password_hash]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        full_name: user.full_name,
        prenom: user.prenom,
        nom: user.nom,
        date_naissance: user.date_naissance,
        adresse: user.adresse,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Connexion par numéro de téléphone + mot de passe
 */
const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    // Trouver l'utilisateur
    const result = await query(
      `SELECT u.*, dp.is_available, dp.truck_type
       FROM users u
       LEFT JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE u.phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      throw new AppError('Numéro ou mot de passe incorrect', 401);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new AppError('Compte désactivé, contactez le support', 401);
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Numéro ou mot de passe incorrect', 401);
    }

    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_available: user.is_available || null,
        truck_type: user.truck_type || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Profil de l'utilisateur connecté
 */
const getMe = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.phone, u.full_name, u.prenom, u.nom, u.date_naissance, u.adresse,
              u.email, u.role, u.profile_photo_url, u.is_verified, u.created_at,
              dp.truck_type, dp.truck_plate, dp.truck_capacity_m3,
              dp.is_available, dp.rating, dp.total_trips, dp.momo_number, dp.momo_provider,
              dp.date_naissance AS driver_date_naissance, dp.adresse AS driver_adresse
       FROM users u
       LEFT JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/driver/profile
 * Compléter le profil chauffeur après inscription
 */
const createDriverProfile = async (req, res, next) => {
  try {
    const {
      truck_type, truck_capacity_m3, truck_plate,
      license_number, momo_number, momo_provider,
      date_naissance, adresse,
    } = req.body;

    // Vérifier que c'est bien un chauffeur
    if (req.user.role !== 'driver') {
      throw new AppError('Seuls les chauffeurs peuvent créer un profil camion', 403);
    }

    // Vérifier si le profil existe déjà
    const existing = await query(
      'SELECT id FROM driver_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      // Mise à jour
      await query(
        `UPDATE driver_profiles SET
          truck_type = $1, truck_capacity_m3 = $2, truck_plate = $3,
          license_number = $4, momo_number = $5, momo_provider = $6,
          date_naissance = $7, adresse = $8,
          updated_at = NOW()
         WHERE user_id = $9`,
        [truck_type, truck_capacity_m3, truck_plate, license_number,
         momo_number, momo_provider, date_naissance || null, adresse || null, req.user.id]
      );
    } else {
      // Création
      await query(
        `INSERT INTO driver_profiles
          (user_id, truck_type, truck_capacity_m3, truck_plate, license_number,
           momo_number, momo_provider, date_naissance, adresse)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [req.user.id, truck_type, truck_capacity_m3, truck_plate,
         license_number, momo_number, momo_provider, date_naissance || null, adresse || null]
      );
    }

    res.json({ message: 'Profil chauffeur enregistré avec succès' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, createDriverProfile };
