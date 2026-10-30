-- BenneGo - Script de migration base de données
-- Plateforme de logistique pour camions de chantier au Bénin

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: users (clients et chauffeurs)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) UNIQUE NOT NULL,       -- Numéro MTN/Moov principal
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'client',  -- 'client', 'driver', 'admin'
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  password_hash VARCHAR(255) NOT NULL,
  profile_photo_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE: driver_profiles (profil chauffeur)
-- =============================================
CREATE TABLE IF NOT EXISTS driver_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  truck_type VARCHAR(50) NOT NULL,           -- 'double_benne', 'simple_benne', 'plateau'
  truck_capacity_m3 DECIMAL(6,2),            -- Capacité en m3
  truck_plate VARCHAR(20) NOT NULL,          -- Plaque d'immatriculation
  truck_photo_url VARCHAR(500),
  license_number VARCHAR(50) NOT NULL,
  license_photo_url VARCHAR(500),
  is_available BOOLEAN DEFAULT false,        -- Disponible pour courses
  current_lat DECIMAL(10, 8),               -- Position GPS actuelle
  current_lng DECIMAL(11, 8),
  last_position_at TIMESTAMP WITH TIME ZONE,
  total_trips INTEGER DEFAULT 0,
  rating DECIMAL(3,2),                       -- Note moyenne /5 (NULL tant qu'aucun avis)
  rating_count INTEGER DEFAULT 0,
  momo_number VARCHAR(20),                   -- Numéro Mobile Money pour paiements
  momo_provider VARCHAR(20),                 -- 'mtn' ou 'moov'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =============================================
-- TABLE: material_types (types de matériaux)
-- =============================================
CREATE TABLE IF NOT EXISTS material_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,               -- 'Sable de rivière', 'Gravier concassé', etc.
  name_local VARCHAR(100),                  -- Nom local (Fon/Yoruba)
  unit VARCHAR(20) DEFAULT 'm3',            -- Unité de mesure
  base_price_per_unit DECIMAL(10,2),        -- Prix de base par unité en FCFA
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE: orders (commandes)
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(20) UNIQUE NOT NULL, -- Ex: LT-2024-001234
  client_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID REFERENCES users(id),      -- NULL jusqu'à acceptation

  -- Localisation chargement (carrière)
  pickup_lat DECIMAL(10, 8) NOT NULL,
  pickup_lng DECIMAL(11, 8) NOT NULL,
  pickup_address TEXT NOT NULL,             -- Ex: "Carrière de Tori-Bossito"
  pickup_contact VARCHAR(20),               -- Contact sur place

  -- Localisation livraison (chantier)
  delivery_lat DECIMAL(10, 8) NOT NULL,
  delivery_lng DECIMAL(11, 8) NOT NULL,
  delivery_address TEXT NOT NULL,           -- Ex: "Chantier Akpakpa, Cotonou"
  delivery_contact VARCHAR(20),

  -- Matériaux
  material_type_id UUID REFERENCES material_types(id),
  quantity_m3 DECIMAL(6,2) NOT NULL,
  material_description TEXT,

  -- Calcul prix
  distance_km DECIMAL(8,2),                -- Distance calculée OSRM
  price_per_km DECIMAL(8,2),
  total_amount DECIMAL(12,2) NOT NULL,      -- Prix total en FCFA
  commission_amount DECIMAL(12,2) NOT NULL, -- 10% = notre commission
  driver_amount DECIMAL(12,2) NOT NULL,     -- 90% = part chauffeur

  -- Statut
  status VARCHAR(30) DEFAULT 'awaiting_payment',
  -- awaiting_payment → (paiement séquestré) pending → accepted → driver_en_route_pickup →
  -- loading → driver_en_route_delivery → delivered → (client confirme) validated → completed
  -- cancelled

  -- Paiement
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  -- unpaid → escrow_held (argent bloqué sur la plateforme)
  --   → payout_pending (client a confirmé, 10% prélevés, reversement chauffeur en cours)
  --   → released (chauffeur payé)   |   escrow_held → refunded (remboursement client)
  payment_method VARCHAR(20),              -- 'mtn_momo', 'moov_money'
  payment_reference VARCHAR(100),          -- Référence FedaPay/KKiaPay
  payment_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  accepted_at TIMESTAMP WITH TIME ZONE,
  pickup_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  validated_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,

  client_rating INTEGER CHECK (client_rating BETWEEN 1 AND 5),
  client_review TEXT,
  rated_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),

  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE: order_tracking (historique GPS)
-- =============================================
CREATE TABLE IF NOT EXISTS order_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES users(id),
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE: transactions (historique paiements)
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  type VARCHAR(30) NOT NULL,               -- 'escrow_hold', 'driver_payout', 'platform_fee', 'refund'
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'XOF',      -- FCFA
  provider VARCHAR(20),                    -- 'fedapay', 'kkiapay'
  provider_reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',    -- 'pending', 'success', 'failed'
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLE: notifications
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEX pour les performances
-- =============================================
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client_status ON orders(client_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON orders(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_is_available ON driver_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order_id ON order_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_transactions_order_type ON transactions(order_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

-- =============================================
-- DONNÉES INITIALES: Types de matériaux
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_material_types_name ON material_types(name);

INSERT INTO material_types (name, name_local, unit, base_price_per_unit) VALUES
  ('Sable de rivière fin', 'Sable', 'm3', 8000),
  ('Sable de rivière grossier', 'Sable grossier', 'm3', 7500),
  ('Gravier concassé 5/15', 'Gravier fin', 'm3', 12000),
  ('Gravier concassé 15/25', 'Gravier', 'm3', 11000),
  ('Latérite', 'Terre rouge', 'm3', 5000),
  ('Terre de remblai', 'Terre', 'm3', 4000),
  ('Cailloux', 'Cailloux', 'm3', 9000)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- MIGRATIONS IDEMPOTENTES (base déjà existante)
-- =============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS released_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'awaiting_payment';
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE driver_profiles ALTER COLUMN rating DROP DEFAULT;

-- Champs profil complet (clients & chauffeurs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nom VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_naissance DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS adresse TEXT;

-- Champs profil complet conducteurs
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS date_naissance DATE;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS adresse TEXT;

-- Un statut de paiement / de commande ne peut prendre que des valeurs connues
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'awaiting_payment','pending','accepted','driver_en_route_pickup','loading',
  'driver_en_route_delivery','delivered','validated','completed','cancelled'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN (
  'unpaid','escrow_held','payout_pending','released','refunded'));

-- =============================================
-- TRANSACTIONS : idempotence garantie par la base
-- =============================================
-- Une seule transaction de chaque type par commande (escrow, payout, commission, refund)
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_order_type ON transactions(order_id, type);
-- Une même référence de paiement KKiaPay ne peut financer qu'une seule commande
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_escrow_ref
  ON transactions(provider, provider_reference) WHERE type = 'escrow_hold';

-- =============================================
-- TABLE: platform_reviews (avis sur la plateforme)
-- =============================================
CREATE TABLE IF NOT EXISTS platform_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_reviews_created ON platform_reviews(created_at DESC);
-- Au plus un avis plateforme par commande
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_reviews_order ON platform_reviews(order_id) WHERE order_id IS NOT NULL;

-- =============================================
-- B2B & EXPANSION SERVICES (BenneGo B2B / BTP)
-- =============================================

-- Table: companies (Entreprises BTP / Grands Comptes)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  ifu VARCHAR(50) UNIQUE,
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(150),
  subscription_status VARCHAR(30) DEFAULT 'inactive', -- 'active', 'expired', 'inactive'
  subscription_plan VARCHAR(50),                     -- 'monthly_saas', 'site_pack'
  subscription_price DECIMAL(12,2) DEFAULT 0,
  subscription_started_at TIMESTAMP WITH TIME ZONE,
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: projects_chantiers (Chantiers rattachés aux entreprises)
CREATE TABLE IF NOT EXISTS projects_chantiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,                        -- Ex: "Asphaltage Phase 2 - Calavi"
  address TEXT,
  central_lat DECIMAL(10, 8) NOT NULL,
  central_lng DECIMAL(11, 8) NOT NULL,
  contact_name VARCHAR(100),
  contact_phone VARCHAR(30),
  status VARCHAR(30) DEFAULT 'active',               -- 'active', 'completed', 'paused'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects_chantiers(company_id);

-- Table: vehicle_types (Catalogue Véhicules & Engins)
CREATE TABLE IF NOT EXISTS vehicle_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,                        -- Ex: "Camion Benne 16m³", "Pelle mécanique"
  category VARCHAR(50) NOT NULL,                     -- 'MATERIAL_TRANSPORT', 'HEAVY_MACHINERY', 'EVACUATION'
  capacity VARCHAR(50),                              -- Ex: "10m³", "16m³", "20T"
  hourly_rate DECIMAL(12,2) DEFAULT 0,               -- Tarif horaire pour location
  base_fare DECIMAL(12,2) DEFAULT 0,                 -- Prise en charge forfaitaire
  km_rate DECIMAL(8,2) DEFAULT 1500,                 -- Prix par km
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_types_name ON vehicle_types(name);
CREATE INDEX IF NOT EXISTS idx_vehicle_types_category ON vehicle_types(category);

-- Colonnes B2B & Chantiers sur les utilisateurs
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Colonnes étendues sur les commandes (orders)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects_chantiers(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) DEFAULT 'MATERIAL'; -- 'MATERIAL', 'RENTAL', 'EVACUATION'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES vehicle_types(id) ON DELETE SET NULL;
-- Type de camion demandé par le client (pricing et répartition : 'pickup' = camionnette). NULL pour les anciennes commandes.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS truck_type VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS duration_hours DECIMAL(6,2); -- Pour location engins
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rental_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rental_end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS evacuation_debris_type VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS evacuation_photo_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS site_cleaned_confirmed BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rental_hours_confirmed BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dump_site_confirmed BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_bulk_order BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bulk_group_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS proforma_invoice_number VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_deviation_alert BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_deviation_details JSONB;

-- Colonnes profil conducteur pour engins
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(50) DEFAULT 'MATERIAL_TRANSPORT';
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES vehicle_types(id) ON DELETE SET NULL;

-- Mise à jour des contraintes de statuts pour inclure les statuts de location et d'évacuation
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'awaiting_payment','pending','accepted','driver_en_route_pickup','loading',
  'driver_en_route_delivery','machine_operating','dumping','delivered','validated','completed','cancelled'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check CHECK (order_type IN (
  'MATERIAL', 'RENTAL', 'EVACUATION'));

-- Catalogue initial des types de véhicules et engins de chantier au Bénin
INSERT INTO vehicle_types (name, category, capacity, hourly_rate, base_fare, km_rate, description) VALUES
  ('Camion Benne 10m³', 'MATERIAL_TRANSPORT', '10m³', 0, 10000, 1500, 'Transport de sable, latérite, gravier 10m³'),
  ('Camion Benne 16m³', 'MATERIAL_TRANSPORT', '16m³', 0, 12000, 1800, 'Double benne gros tonnage 16m³'),
  ('Semi-remorque Benne', 'MATERIAL_TRANSPORT', '25m³', 0, 15000, 2200, 'Semi-remorque grands chantiers 25m³'),
  ('Camion Plateau', 'MATERIAL_TRANSPORT', '15T', 0, 12000, 1600, 'Transport de briques, parpaings, fer à béton'),
  ('Camion avec Grue', 'MATERIAL_TRANSPORT', '12T', 0, 20000, 2000, 'Transport et déchargement avec grue embarquée'),
  ('Pelle Mécanique (Excavatrice)', 'HEAVY_MACHINERY', '20T', 35000, 30000, 0, 'Excavation, fouilles, tranchées de fondation'),
  ('Chargeuse sur Pneus', 'HEAVY_MACHINERY', '15T', 30000, 25000, 0, 'Chargement de terre, sable et remblai'),
  ('Bulldozer', 'HEAVY_MACHINERY', '25T', 40000, 35000, 0, 'Terrassement lourd et décapage de terrain'),
  ('Compacteur (Rouleau)', 'HEAVY_MACHINERY', '12T', 25000, 20000, 0, 'Compactage des sols avant coulage de béton'),
  ('Niveleuse', 'HEAVY_MACHINERY', '18T', 35000, 30000, 0, 'Nivellement de voiries et plateformes de chantier'),
  ('Benne à Gravats 10m³', 'EVACUATION', '10m³', 0, 25000, 1500, 'Évacuation de gravats et débris de démolition'),
  ('Camion Évacuation Déblais 16m³', 'EVACUATION', '16m³', 0, 35000, 1800, 'Évacuation de terre excédentaire vers sites de remblai')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  capacity = EXCLUDED.capacity,
  hourly_rate = EXCLUDED.hourly_rate,
  base_fare = EXCLUDED.base_fare,
  km_rate = EXCLUDED.km_rate,
  description = EXCLUDED.description;

-- Enrichissement des matériaux BTP (Second Œuvre, Ciment, Briques)
INSERT INTO material_types (name, name_local, unit, base_price_per_unit) VALUES
  ('Ciment en sacs (50kg)', 'Ciment', 'sac', 4500),
  ('Briques creuses de 15', 'Brique 15', 'unite', 350),
  ('Briques pleines de 15', 'Brique pleine', 'unite', 400),
  ('Pavés autobloquants', 'Pavé', 'm2', 6500),
  ('Fer à béton (tonne)', 'Fer à béton', 'tonne', 550000)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- CODES PROMO & REMISES
-- =============================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage' ou 'fixed'
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(12,2) DEFAULT 0,
  max_discount DECIMAL(12,2),
  usage_limit INT DEFAULT 100,
  times_used INT DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- =============================================
-- SYSTÈME DE PARRAINAGE
-- =============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(30) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL,
  reward_amount DECIMAL(10,2) DEFAULT 2500,
  status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'rewarded', 'cancelled'
  rewarded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_referrals_referee UNIQUE (referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- =============================================
-- CHAT TEMPS RÉEL (Socket.IO + Persistance)
-- =============================================
CREATE TABLE IF NOT EXISTS order_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name VARCHAR(150),
  sender_role VARCHAR(30),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_order ON order_chat_messages(order_id);

-- =============================================
-- COMMANDES RÉCURRENTES & PREUVE DE LIVRAISON (PoD)
-- =============================================
CREATE TABLE IF NOT EXISTS recurring_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency VARCHAR(30) NOT NULL, -- 'daily', 'weekly', 'biweekly', 'monthly'
  order_template JSONB NOT NULL,
  next_run_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pod_photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pod_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pod_submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recurring_order_id UUID REFERENCES recurring_orders(id) ON DELETE SET NULL;

-- Initialisation de codes promos de test
INSERT INTO promo_codes (code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, is_active) VALUES
  ('BIENVENUE10', 'percentage', 10, 10000, 15000, 500, true),
  ('BTP2026', 'fixed', 5000, 30000, 5000, 200, true),
  ('BENNEGO5', 'percentage', 5, 0, 10000, 1000, true)
ON CONFLICT (code) DO NOTHING;

-- Le compte administrateur se crée avec : npm run create-admin (backend)

-- =============================================================================
-- EXTENSION BENNEGO-PRO (B2B BTP), GESTION CONDUCTEURS & CONSOLE ADMIN
-- =============================================================================

-- 1. ENRICHISSEMENT ENTREPRISES BTP & COMPTES GRANDS COMPTES
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rccm VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_name VARCHAR(200);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tva_subject BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS aib_rate DECIMAL(4,2) DEFAULT 1.00;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(14,2) DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_term_days INT DEFAULT 0;

ALTER TABLE projects_chantiers ADD COLUMN IF NOT EXISTS perimeter_radius_meters INT DEFAULT 500;
ALTER TABLE projects_chantiers ADD COLUMN IF NOT EXISTS site_manager_name VARCHAR(120);
ALTER TABLE projects_chantiers ADD COLUMN IF NOT EXISTS site_manager_phone VARCHAR(30);
ALTER TABLE projects_chantiers ADD COLUMN IF NOT EXISTS authorized_dump_zone_lat DECIMAL(10, 8);
ALTER TABLE projects_chantiers ADD COLUMN IF NOT EXISTS authorized_dump_zone_lng DECIMAL(11, 8);

-- 2. COMMANDES MULTI-ROTATIONS & GROS VOLUMES B2B
CREATE TABLE IF NOT EXISTS order_rotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  bulk_group_id UUID,
  rotation_number INT NOT NULL,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  truck_plate VARCHAR(30),
  truck_capacity_m3 DECIMAL(6,2),
  status VARCHAR(30) DEFAULT 'scheduled',
  quarry_ticket_number VARCHAR(100),
  gross_weight_tonnes DECIMAL(8,2),
  tare_weight_tonnes DECIMAL(8,2),
  net_material_weight_tonnes DECIMAL(8,2),
  quarry_ticket_photo_url TEXT,
  loading_started_at TIMESTAMP WITH TIME ZONE,
  weighed_at TIMESTAMP WITH TIME ZONE,
  departure_time TIMESTAMP WITH TIME ZONE,
  arrival_site_time TIMESTAMP WITH TIME ZONE,
  dumping_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  pod_signature_url TEXT,
  pod_receiver_name VARCHAR(100),
  pod_receiver_phone VARCHAR(30),
  pod_photos JSONB DEFAULT '[]'::jsonb,
  pod_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rotations_order ON order_rotations(order_id);
CREATE INDEX IF NOT EXISTS idx_rotations_driver ON order_rotations(driver_id);
CREATE INDEX IF NOT EXISTS idx_rotations_status ON order_rotations(status);

-- 3. MATÉRIAUX BTP PRÉCIS AU BÉNIN
INSERT INTO material_types (name, name_local, unit, base_price_per_unit) VALUES
  ('Sable de lagune (fin)', 'Sable lagune', 'm3', 7500),
  ('Sable lavé de rivière', 'Sable lavé', 'm3', 9500),
  ('Gravier concassé 5/15', 'Gravier béton fin', 'm3', 13500),
  ('Gravier concassé 15/25', 'Gravier gros béton', 'm3', 12500),
  ('Tout-venant 0/31.5', 'Tout-venant compactage', 'm3', 11000),
  ('Terre rouge latéritique', 'Latérite de remblai', 'm3', 6000),
  ('Évacuation gravats démolition', 'Gravats', 'm3', 5000),
  ('Évacuation terre végétale', 'Terre excédentaire', 'm3', 4500)
ON CONFLICT (name) DO UPDATE SET
  base_price_per_unit = EXCLUDED.base_price_per_unit,
  unit = EXCLUDED.unit;

-- 4. CONFORMITÉ FISCALE & FACTURATION B2B (TVA Bénin 18% & AIB)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_ht DECIMAL(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tva_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS aib_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_ttc DECIMAL(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS b2b_purchase_order_ref VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS proforma_pdf_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_invoice_pdf_url TEXT;

-- 5. SUIVI RIGOUREUX DES CONDUCTEURS & VÉHICULES
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS carte_grise_number VARCHAR(60);
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS carte_grise_photo_url TEXT;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS carte_grise_expires_at DATE;

ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS visite_technique_number VARCHAR(60);
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS visite_technique_photo_url TEXT;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS visite_technique_expires_at DATE;

ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(60);
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS insurance_company VARCHAR(100);
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS insurance_photo_url TEXT;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS insurance_expires_at DATE;

ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS truck_payload_tonnes DECIMAL(6,2) DEFAULT 20.00;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS truck_axle_count INT DEFAULT 3;

ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12,2) DEFAULT 0;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS pending_payout_balance DECIMAL(12,2) DEFAULT 0;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS total_tips_earned DECIMAL(12,2) DEFAULT 0;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'pending';

-- 6. GESTION DES LITIGES ET SÉCURISATION DU SÉQUESTRE (Console Admin)
CREATE TABLE IF NOT EXISTS order_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  opened_by_user_id UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  evidence_photos JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'opened',
  resolution_notes TEXT,
  resolved_by_admin_id UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_delay_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rotation_id UUID REFERENCES order_rotations(id) ON DELETE CASCADE,
  expected_arrival TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_or_current_delay_minutes INT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  alert_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_order ON order_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_alerts_order ON site_delay_alerts(order_id);


                                                                                                                                                               
    -- =============================================================================                                                                                                       
    -- EXTENSION DU MASTERPLAN LANCEMENT.MD & CORRECTIFS SCHEMA DDL                                                                                                                        
    -- =============================================================================                                                                                                       
                                                                                                                                                                                           
    -- 1. Mode Flotte & Télémétrie "Œil de Patron"                                                                                                                                         
    CREATE TABLE IF NOT EXISTS fleets (                                                                                                                                                    
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                                                                                                                                      
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,                                                                                                                       
      name VARCHAR(150) NOT NULL,                                                                                                                                                          
      momo_payout_number VARCHAR(30) NOT NULL,                                                                                                                                             
      momo_payout_provider VARCHAR(20) DEFAULT 'mtn',                                                                                                                                      
      driver_share_percentage DECIMAL(5,2) DEFAULT 30.00,                                                                                                                                  
      insurance_partner VARCHAR(100) DEFAULT 'NSIA Assurances Bénin',                                                                                                                      
      insurance_discount_pct DECIMAL(4,2) DEFAULT 20.00,                                                                                                                                   
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()                                                                                                                                    
    );                                                                                                                                                                                     
                                                                                                                                                                                           
    CREATE TABLE IF NOT EXISTS fleet_trucks (                                                                                                                                              
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                                                                                                                                      
      fleet_id UUID NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,                                                                                                                      
      truck_plate VARCHAR(30) NOT NULL UNIQUE,                                                                                                                                             
      driver_id UUID REFERENCES users(id) ON DELETE SET NULL,                                                                                                                              
      truck_type VARCHAR(50) DEFAULT 'double_benne',                                                                                                                                       
      is_active BOOLEAN DEFAULT true,                                                                                                                                                      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()                                                                                                                                    
    );                                                                                                                                                                                     
                                                                                                                                                                                           
    CREATE TABLE IF NOT EXISTS fleet_stop_alerts (                                                                                                                                         
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                                                                                                                                      
      fleet_id UUID REFERENCES fleets(id) ON DELETE CASCADE,                                                                                                                               
      driver_id UUID REFERENCES users(id) ON DELETE CASCADE,                                                                                                                               
      truck_plate VARCHAR(30) NOT NULL,                                                                                                                                                    
      stop_lat DECIMAL(10, 8) NOT NULL,                                                                                                                                                    
      stop_lng DECIMAL(11, 8) NOT NULL,                                                                                                                                                    
      duration_minutes INT NOT NULL,                                                                                                                                                       
      alert_type VARCHAR(50) DEFAULT 'ABNORMAL_PROLONGED_STOP',                                                                                                                            
      status VARCHAR(30) DEFAULT 'active',                                                                                                                                                 
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),                                                                                                                                   
      resolved_at TIMESTAMP WITH TIME ZONE                                                                                                                                                 
    );                                                                                                                                                                                     
                                                                                                                                                                                           
    -- 3. Continuité de Chantier (SLA Béton Relève)                                                                                                                                        
    CREATE TABLE IF NOT EXISTS breakdown_relief_requests (                                                                                                                                 
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                                                                                                                                      
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,                                                                                                                      
      original_driver_id UUID NOT NULL REFERENCES users(id),                                                                                                                               
      relief_driver_id UUID REFERENCES users(id),                                                                                                                                          
      breakdown_reason VARCHAR(100) NOT NULL,                                                                                                                                              
      lat DECIMAL(10, 8) NOT NULL,                                                                                                                                                         
      lng DECIMAL(11, 8) NOT NULL,                                                                                                                                                         
      status VARCHAR(30) DEFAULT 'pending',                                                                                                                                                
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),                                                                                                                                   
      assigned_at TIMESTAMP WITH TIME ZONE                                                                                                                                                 
    );                                                                                                                                                                                     
                                                                                                                                                                                           
    -- 4. Baromètre Hebdomadaire des Prix BTP                                                                                                                                              
    CREATE TABLE IF NOT EXISTS btp_price_barometer (                                                                                                                                       
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                                                                                                                                      
      material_name VARCHAR(100) NOT NULL,                                                                                                                                                 
      avg_price_m3 DECIMAL(10,2) NOT NULL,                                                                                                                                                 
      min_price_m3 DECIMAL(10,2) NOT NULL,                                                                                                                                                 
      max_price_m3 DECIMAL(10,2) NOT NULL,                                                                                                                                                 
      week_number INT NOT NULL,                                                                                                                                                            
      year INT NOT NULL,                                                                                                                                                                   
      trend VARCHAR(20) DEFAULT 'stable',                                                                                                                                                  
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()                                                                                                                                    
    );                                                                                                                                                                                     
                                                                                                                                                                                           
    CREATE UNIQUE INDEX IF NOT EXISTS uq_btp_barometer ON btp_price_barometer(material_name, week_number, year);                                                                           
                                                                                                                                                                                           
    INSERT INTO btp_price_barometer (material_name, avg_price_m3, min_price_m3, max_price_m3, week_number, year, trend) VALUES                                                             
      ('Sable de lagune (fin)', 7500, 7000, 8000, 42, 2026, 'stable'),                                                                                                                     
      ('Sable lavé de rivière (Tori)', 9500, 9000, 10500, 42, 2026, 'up'),                                                                                                                 
      ('Gravier concassé 5/15', 13500, 13000, 14500, 42, 2026, 'stable'),                                                                                                                  
      ('Gravier concassé 15/25', 12500, 12000, 13500, 42, 2026, 'down'),                                                                                                                   
      ('Latérite de remblai', 6000, 5500, 6500, 42, 2026, 'stable')                                                                                                                        
    ON CONFLICT DO NOTHING;                                                                                                                                                                
    
-- =============================================
-- NETTOYAGE : fonctions retirées (carrières, avance carburant, retrait instantané)
-- =============================================
DROP TABLE IF EXISTS job_applications;
DROP TABLE IF EXISTS careers;
DROP TABLE IF EXISTS fuel_advances;
DROP TABLE IF EXISTS driver_instant_cashouts;

-- =============================================
-- VÉRIFICATION DU NUMÉRO (OTP à l'inscription) — le code n'est jamais stocké en clair
-- =============================================
CREATE TABLE IF NOT EXISTS phone_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  consumed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone, created_at DESC);

-- =============================================
-- PHOTOS DE COMMANDE (chargement, ticket de pesée, litige) — fichiers stockés hors base
-- =============================================
CREATE TABLE IF NOT EXISTS order_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT order_photos_kind_check CHECK (kind IN ('loading', 'weighbridge', 'dispute'))
);
CREATE INDEX IF NOT EXISTS idx_order_photos_order ON order_photos(order_id, kind);

-- =============================================
-- CHARGEMENT & PESÉE : volume déclaré par le chauffeur avant le départ
-- =============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loading_volume_m3 DECIMAL(6,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loading_recorded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS weighbridge_net_kg INT;

-- =============================================
-- LITIGE À LA LIVRAISON (refus avec photo, traité par l'admin)
-- =============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_dispute_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_dispute_status_check CHECK (dispute_status IN ('open', 'refunded', 'released'));

-- =============================================
-- MESSAGERIE : lecture des discussions (pastilles non lus) et abonnements aux notifications push
-- =============================================
CREATE TABLE IF NOT EXISTS order_chat_reads (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, user_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- =============================================
-- PARRAINAGE : primes selon le type de compte, réduction du filleul, crédit BenneGo et versements
-- Même type (client→client, camionneur→camionneur) : 1 500 FCFA au parrain et 1 500 au filleul.
-- Croisé (client↔camionneur) : 1 000 FCFA au parrain. Prime versée à la 1re commande ou course livrée et confirmée.
-- =============================================
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_role VARCHAR(20);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referee_role VARCHAR(20);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referee_reward DECIMAL(10,2) DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS welcome_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS qualifying_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Montant payé par le client = total_amount - discount_amount (la part du chauffeur ne change pas)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_discount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_used DECIMAL(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;

-- Demandes de versement du crédit (camionneurs), traitées par l'administration
CREATE TABLE IF NOT EXISTS credit_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  momo_number VARCHAR(20),
  momo_provider VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'requested',
  reference VARCHAR(100),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT credit_payouts_status_check CHECK (status IN ('requested', 'paid', 'rejected'))
);
CREATE INDEX IF NOT EXISTS idx_credit_payouts_user ON credit_payouts(user_id);

-- Crédit BenneGo : chaque mouvement (prime gagnée, crédit utilisé, versement) ; le solde est la somme
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  reason VARCHAR(40) NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  payout_id UUID REFERENCES credit_payouts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);
-- Une seule prime par parrainage et par bénéficiaire, même si la confirmation est rejouée
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_credits_referral ON user_credits(referral_id, user_id, reason) WHERE referral_id IS NOT NULL;

-- Détail du prix calculé à la commande (prise en charge, transport, chargement, arrondi…) pour la console admin
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_breakdown JSONB;

-- =============================================
-- Réglages du compte : préférences, appareils connectés, suppression différée
-- =============================================
-- Préférences (notifications par type, heures calmes, confidentialité), fusionnées avec les valeurs par défaut du rôle
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Jetons émis avant cette date sans appareil enregistré : refusés (« déconnecter les autres appareils »)
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_revoked_before TIMESTAMP WITH TIME ZONE;
-- Suppression demandée : récupérable 60 jours ; à 60 jours le numéro est libéré ; à 6 mois les données sont effacées
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(300);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_label VARCHAR(120),
  user_agent VARCHAR(300),
  ip VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_deletion ON users(deletion_requested_at) WHERE deletion_requested_at IS NOT NULL;

-- =============================================
-- Réglages de la plateforme (objectif mensuel de chiffre d'affaires de la console Analyses…)
-- =============================================
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(60) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Analyses par période : commandes filtrées et regroupées par date de création
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- =============================================
-- Prix du marché au voyage (noms de matériaux d'ici, taille du camion, semaine du lundi au dimanche)
-- Les anciens indices au m³ (semaine/année) restent en base mais ne sont plus affichés.
-- =============================================
ALTER TABLE btp_price_barometer ADD COLUMN IF NOT EXISTS material_key VARCHAR(40);
ALTER TABLE btp_price_barometer ADD COLUMN IF NOT EXISTS truck_size VARCHAR(20);
ALTER TABLE btp_price_barometer ADD COLUMN IF NOT EXISTS week_start DATE;
ALTER TABLE btp_price_barometer ADD COLUMN IF NOT EXISTS price_min NUMERIC(12,0);
ALTER TABLE btp_price_barometer ADD COLUMN IF NOT EXISTS price_avg NUMERIC(12,0);
ALTER TABLE btp_price_barometer ADD COLUMN IF NOT EXISTS price_max NUMERIC(12,0);
ALTER TABLE btp_price_barometer ALTER COLUMN avg_price_m3 DROP NOT NULL;
ALTER TABLE btp_price_barometer ALTER COLUMN min_price_m3 DROP NOT NULL;
ALTER TABLE btp_price_barometer ALTER COLUMN max_price_m3 DROP NOT NULL;
ALTER TABLE btp_price_barometer ALTER COLUMN week_number DROP NOT NULL;
ALTER TABLE btp_price_barometer ALTER COLUMN year DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_btp_barometer_voyage ON btp_price_barometer(material_key, truck_size, week_start)
  WHERE week_start IS NOT NULL;
