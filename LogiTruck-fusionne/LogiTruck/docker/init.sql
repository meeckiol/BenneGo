-- LogiTruck - Script de migration base de données
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
CREATE INDEX IF NOT EXISTS idx_driver_profiles_is_available ON driver_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order_id ON order_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read);

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

-- Le compte administrateur se crée avec : npm run create-admin (backend)
