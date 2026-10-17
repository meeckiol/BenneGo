import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { payOrder } from '../services/kkiapay';

const DEFAULT_COTONOU = { lat: 6.3654, lng: 2.4183, address: 'Cotonou, Bénin' };
const DEFAULT_CARRIERE = { lat: 6.5050, lng: 2.3050, address: 'Carrière de Tori-Bossito' };
const DEFAULT_DECHARGE = { lat: 6.4800, lng: 2.3500, address: 'Décharge contrôlée d\'Akassato' };

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') || 'MATERIAL';

  const [orderType, setOrderType] = useState(initialType);
  const [step, setStep] = useState(1); // 1: Formulaire, 2: Estimation, 3: Paiement
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [projects, setProjects] = useState([]);

  // Formulaire unifié & dynamique
  const [form, setForm] = useState({
    order_type: initialType,
    project_id: '',
    vehicle_type_id: '',

    // 🏗️ 1. Matériaux
    material_type_id: '',
    quantity_m3: 16,
    material_description: '',
    truck_type: 'double_benne',
    pickup_address: DEFAULT_CARRIERE.address,
    pickup_lat: DEFAULT_CARRIERE.lat,
    pickup_lng: DEFAULT_CARRIERE.lng,
    delivery_address: DEFAULT_COTONOU.address,
    delivery_lat: DEFAULT_COTONOU.lat,
    delivery_lng: DEFAULT_COTONOU.lng,

    // 🚜 2. Location Engins
    machinery_type: 'excavatrice',
    duration_hours: 8,
    rental_start_date: new Date().toISOString().split('T')[0],

    // 📦 3. Évacuation Gravats
    evacuation_debris_type: 'Gravats de démolition et béton',
    evacuation_photo_url: '',
    rotations: 2,
    notes: '',
  });

  const [estimate, setEstimate] = useState(null);

  // Charger les données de référence (matériaux, types de véhicules/engins, chantiers)
  useEffect(() => {
    // Matériaux
    api.get('/companies/vehicle-types')
      .then(({ data }) => setVehicles(data.vehicle_types || []))
      .catch(() => {});

    // Chantiers de l'entreprise si B2B
    api.get('/companies/projects')
      .then(({ data }) => setProjects(data.projects || []))
      .catch(() => {});
  }, []);

  // Synchroniser quand orderType change
  const handleTypeSelect = (type) => {
    setOrderType(type);
    setForm((prev) => ({
      ...prev,
      order_type: type,
      pickup_address: type === 'EVACUATION' ? DEFAULT_COTONOU.address : DEFAULT_CARRIERE.address,
      delivery_address: type === 'EVACUATION' ? DEFAULT_DECHARGE.address : DEFAULT_COTONOU.address,
      pickup_lat: type === 'EVACUATION' ? DEFAULT_COTONOU.lat : DEFAULT_CARRIERE.lat,
      pickup_lng: type === 'EVACUATION' ? DEFAULT_COTONOU.lng : DEFAULT_CARRIERE.lng,
      delivery_lat: type === 'EVACUATION' ? DEFAULT_DECHARGE.lat : DEFAULT_COTONOU.lat,
      delivery_lng: type === 'EVACUATION' ? DEFAULT_DECHARGE.lng : DEFAULT_COTONOU.lng,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Sélection d'un chantier enregistré (remplit automatiquement l'adresse et le GPS)
  const handleProjectSelect = (e) => {
    const pId = e.target.value;
    const project = projects.find((p) => p.id === pId);
    if (project) {
      setForm((prev) => ({
        ...prev,
        project_id: pId,
        delivery_address: orderType === 'EVACUATION' ? prev.delivery_address : project.address || project.name,
        delivery_lat: orderType === 'EVACUATION' ? prev.delivery_lat : project.central_lat,
        delivery_lng: orderType === 'EVACUATION' ? prev.delivery_lng : project.central_lng,
        pickup_address: orderType === 'EVACUATION' ? project.address || project.name : prev.pickup_address,
        pickup_lat: orderType === 'EVACUATION' ? project.central_lat : prev.pickup_lat,
        pickup_lng: orderType === 'EVACUATION' ? project.central_lng : prev.pickup_lng,
      }));
    } else {
      setForm((prev) => ({ ...prev, project_id: '' }));
    }
  };

  // Calcul du prix via le backend
  const getEstimate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        order_type: orderType,
        pickup_lat: form.pickup_lat,
        pickup_lng: form.pickup_lng,
        delivery_lat: form.delivery_lat,
        delivery_lng: form.delivery_lng,
        truck_type: form.truck_type,
        vehicle_type_id: form.vehicle_type_id || undefined,
        quantity_m3: form.quantity_m3,
        duration_hours: form.duration_hours,
        machinery_type: form.machinery_type,
        rotations: form.rotations,
      };

      const { data } = await api.post('/orders/estimate', payload);
      setEstimate(data);
      setStep(2);
    } catch (err) {
      // Affiché par l'intercepteur API
    } finally {
      setLoading(false);
    }
  };

  // Création et paiement séquestre
  const confirmOrder = async () => {
    setLoading(true);
    let orderId;
    try {
      const payload = {
        ...form,
        order_type: orderType,
      };

      const { data } = await api.post('/orders', payload);
      orderId = data.order.id;

      // Déclenchement du paiement KKiaPay (MTN / Moov) bloqué en séquestre
      const res = await payOrder(orderId);
      if (res.ok) {
        toast.success('Paiement sécurisé en séquestre ! Un prestataire va accepter sous peu.');
      } else {
        toast('Paiement non finalisé : vous pouvez régler depuis votre espace de suivi.', { icon: 'ℹ️' });
      }
    } catch (err) {
      if (err?.message && !err.response) toast.error(err.message);
    } finally {
      setLoading(false);
      if (orderId) navigate(`/orders/${orderId}`);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.back}>← Retour</button>
        <h2 style={styles.title}>
          {orderType === 'MATERIAL' && '🏗️ Transport de Matériaux'}
          {orderType === 'RENTAL' && '🚜 Location d\'Engin Lourd'}
          {orderType === 'EVACUATION' && '📦 Évacuation de Gravats'}
        </h2>
      </header>

      <div style={styles.content}>
        {/* Onglets de sélection du service */}
        {step === 1 && (
          <div style={styles.tabs}>
            <button
              type="button"
              onClick={() => handleTypeSelect('MATERIAL')}
              style={{
                ...styles.tabBtn,
                background: orderType === 'MATERIAL' ? '#FF6B00' : 'white',
                color: orderType === 'MATERIAL' ? 'white' : '#475569',
              }}
            >
              🏗️ Matériaux
            </button>
            <button
              type="button"
              onClick={() => handleTypeSelect('RENTAL')}
              style={{
                ...styles.tabBtn,
                background: orderType === 'RENTAL' ? '#1976D2' : 'white',
                color: orderType === 'RENTAL' ? 'white' : '#475569',
              }}
            >
              🚜 Louer un Engin
            </button>
            <button
              type="button"
              onClick={() => handleTypeSelect('EVACUATION')}
              style={{
                ...styles.tabBtn,
                background: orderType === 'EVACUATION' ? '#388E3C' : 'white',
                color: orderType === 'EVACUATION' ? 'white' : '#475569',
              }}
            >
              📦 Évacuer Gravats
            </button>
          </div>
        )}

        {/* Étape 1 : Formulaire adapté selon le service */}
        {step === 1 && (
          <form onSubmit={getEstimate} style={styles.form}>
            {/* Rattachement à un chantier B2B optionnel */}
            {projects.length > 0 && (
              <Section title="🏢 Chantier Entreprise (Optionnel)">
                <Field label="Associer à un projet de chantier">
                  <select
                    name="project_id"
                    value={form.project_id}
                    onChange={handleProjectSelect}
                    style={styles.input}
                  >
                    <option value="">-- Commande ponctuelle (hors projet) --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </Field>
              </Section>
            )}

            {/* CAS 1 : TRANSPORT DE MATÉRIAUX */}
            {orderType === 'MATERIAL' && (
              <>
                <Section title="1. Matériaux & Camion">
                  <Field label="Matériau commandé">
                    <input
                      name="material_description"
                      value={form.material_description}
                      onChange={handleChange}
                      placeholder="Ex: Sable de mer, Gravier concassé 15/25, Latérite, Briques..."
                      style={styles.input}
                      required
                    />
                  </Field>
                  <div style={styles.row}>
                    <Field label="Volume estimé (m³ ou tonnes)">
                      <input
                        name="quantity_m3"
                        type="number"
                        min="1"
                        max="200"
                        step="0.5"
                        value={form.quantity_m3}
                        onChange={handleChange}
                        style={styles.input}
                        required
                      />
                    </Field>
                    <Field label="Type de camion requis">
                      <select name="truck_type" value={form.truck_type} onChange={handleChange} style={styles.input}>
                        <option value="simple_benne">Camion Benne 10m³</option>
                        <option value="double_benne">Camion Benne 16m³ (Double benne)</option>
                        <option value="semi_remorque">Semi-remorque Benne (25m³)</option>
                        <option value="plateau">Camion Plateau (Briques/Fer)</option>
                        <option value="grue">Camion avec Grue embarquée</option>
                      </select>
                    </Field>
                  </div>
                </Section>

                <Section title="2. Itinéraire de Livraison">
                  <Field label="Carrière de chargement (Départ)">
                    <input
                      name="pickup_address"
                      value={form.pickup_address}
                      onChange={handleChange}
                      style={styles.input}
                      required
                    />
                  </Field>
                  <Field label="Adresse du Chantier de livraison (Arrivée)">
                    <input
                      name="delivery_address"
                      value={form.delivery_address}
                      onChange={handleChange}
                      style={styles.input}
                      required
                    />
                  </Field>
                  <div style={styles.row}>
                    <Field label="Latitude Chantier">
                      <input
                        name="delivery_lat"
                        type="number"
                        step="0.000001"
                        value={form.delivery_lat}
                        onChange={handleChange}
                        style={styles.input}
                        required
                      />
                    </Field>
                    <Field label="Longitude Chantier">
                      <input
                        name="delivery_lng"
                        type="number"
                        step="0.000001"
                        value={form.delivery_lng}
                        onChange={handleChange}
                        style={styles.input}
                        required
                      />
                    </Field>
                  </div>
                </Section>
              </>
            )}

            {/* CAS 2 : LOCATION D'ENGINS LOURDS */}
            {orderType === 'RENTAL' && (
              <>
                <Section title="1. Sélection de l'Engin Lourd">
                  <Field label="Type d'engin de chantier requis">
                    <select name="machinery_type" value={form.machinery_type} onChange={handleChange} style={styles.input}>
                      <option value="excavatrice">Pelle Mécanique (Excavatrice 20T) - 35 000 FCFA/h</option>
                      <option value="chargeuse">Chargeuse sur Pneus (15T) - 30 000 FCFA/h</option>
                      <option value="bulldozer">Bulldozer de terrassement (25T) - 40 000 FCFA/h</option>
                      <option value="compacteur">Compacteur / Rouleau compresseur - 25 000 FCFA/h</option>
                      <option value="niveleuse">Niveleuse de voiries (18T) - 35 000 FCFA/h</option>
                    </select>
                  </Field>
                  <div style={styles.row}>
                    <Field label="Date de début d'opération">
                      <input
                        name="rental_start_date"
                        type="date"
                        value={form.rental_start_date}
                        onChange={handleChange}
                        style={styles.input}
                        required
                      />
                    </Field>
                    <Field label="Durée de travail (Heures)">
                      <select name="duration_hours" value={form.duration_hours} onChange={handleChange} style={styles.input}>
                        <option value="4">Demi-journée (4 heures)</option>
                        <option value="8">Journée complète (8 heures)</option>
                        <option value="16">2 Journées (16 heures)</option>
                        <option value="24">3 Journées (24 heures)</option>
                        <option value="40">Semaine ouvrée (40 heures)</option>
                      </select>
                    </Field>
                  </div>
                </Section>

                <Section title="2. Chantier de déploiement de l'engin">
                  <Field label="Adresse du chantier">
                    <input
                      name="delivery_address"
                      value={form.delivery_address}
                      onChange={handleChange}
                      placeholder="Ex: Chantier Cocotomey, Calavi ou Akpakpa"
                      style={styles.input}
                      required
                    />
                  </Field>
                  <div style={styles.row}>
                    <Field label="Latitude GPS">
                      <input
                        name="delivery_lat"
                        type="number"
                        step="0.000001"
                        value={form.delivery_lat}
                        onChange={handleChange}
                        style={styles.input}
                        required
                      />
                    </Field>
                    <Field label="Longitude GPS">
                      <input
                        name="delivery_lng"
                        type="number"
                        step="0.000001"
                        value={form.delivery_lng}
                        onChange={handleChange}
                        style={styles.input}
                        required
                      />
                    </Field>
                  </div>
                </Section>
              </>
            )}

            {/* CAS 3 : ÉVACUATION DE GRAVATS */}
            {orderType === 'EVACUATION' && (
              <>
                <Section title="1. Débris & Volume à Évacuer">
                  <Field label="Nature des débris">
                    <select
                      name="evacuation_debris_type"
                      value={form.evacuation_debris_type}
                      onChange={handleChange}
                      style={styles.input}
                    >
                      <option value="Gravats de démolition et béton">Gravats de démolition et morceaux de béton</option>
                      <option value="Terre de déblai excédentaire">Terre excédentaire de fouille / terrassement</option>
                      <option value="Débris mixtes et chutes de chantier">Débris mixtes, plâtre et chutes de chantier</option>
                    </select>
                  </Field>
                  <div style={styles.row}>
                    <Field label="Nombre estimé de camions (rotations)">
                      <input
                        name="rotations"
                        type="number"
                        min="1"
                        max="20"
                        value={form.rotations}
                        onChange={handleChange}
                        style={styles.input}
                        required
                      />
                    </Field>
                    <Field label="Photo du tas de gravats (Optionnel)">
                      <input
                        name="evacuation_photo_url"
                        value={form.evacuation_photo_url}
                        onChange={handleChange}
                        placeholder="Lien ou référence photo"
                        style={styles.input}
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="2. Points de Ramassage et de Décharge">
                  <Field label="Adresse du Chantier à nettoyer (Ramassage)">
                    <input
                      name="pickup_address"
                      value={form.pickup_address}
                      onChange={handleChange}
                      style={styles.input}
                      required
                    />
                  </Field>
                  <Field label="Décharge autorisée de destination">
                    <input
                      name="delivery_address"
                      value={form.delivery_address}
                      onChange={handleChange}
                      style={styles.input}
                      required
                    />
                  </Field>
                </Section>
              </>
            )}

            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Calcul de l\'estimation...' : 'Calculer le tarif officiel LogiTruck →'}
            </button>
          </form>
        )}

        {/* Étape 2 : Récapitulatif du prix et engagement séquestre */}
        {step === 2 && estimate && (
          <div style={styles.estimate}>
            <h3 style={styles.estimateTitle}>Détail de votre Devis Séquestre</h3>

            <div style={styles.estimateCard}>
              <div style={styles.estimateRow}>
                <span>Type de prestation</span>
                <strong>
                  {orderType === 'MATERIAL' && 'Transport de Matériaux'}
                  {orderType === 'RENTAL' && 'Location d\'Engin Lourd'}
                  {orderType === 'EVACUATION' && 'Logistique d\'Évacuation de Gravats'}
                </strong>
              </div>

              {orderType === 'RENTAL' ? (
                <>
                  <div style={styles.estimateRow}>
                    <span>Durée de réservation</span>
                    <strong>{estimate.breakdown?.duration_hours} heures</strong>
                  </div>
                  <div style={styles.estimateRow}>
                    <span>Tarif horaire engin</span>
                    <span>{estimate.breakdown?.hourly_rate?.toLocaleString()} FCFA/h</span>
                  </div>
                  <div style={styles.estimateRow}>
                    <span>Sous-total opération</span>
                    <span>{estimate.breakdown?.rental_subtotal?.toLocaleString()} FCFA</span>
                  </div>
                  <div style={styles.estimateRow}>
                    <span>Mobilisation & transport engin</span>
                    <span>{estimate.breakdown?.mobilization_fee?.toLocaleString()} FCFA</span>
                  </div>
                </>
              ) : orderType === 'EVACUATION' ? (
                <>
                  <div style={styles.estimateRow}>
                    <span>Nombre de rotations / camions</span>
                    <strong>{estimate.breakdown?.rotations} rotation(s)</strong>
                  </div>
                  <div style={styles.estimateRow}>
                    <span>Forfait prise en charge</span>
                    <span>{estimate.breakdown?.base_pickup_fee?.toLocaleString()} FCFA</span>
                  </div>
                  <div style={styles.estimateRow}>
                    <span>Distance vers décharge</span>
                    <span>{estimate.distance_km} km ({estimate.breakdown?.distance_cost?.toLocaleString()} FCFA)</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.estimateRow}>
                    <span>Distance itinéraire OSRM</span>
                    <strong>{estimate.distance_km} km (~{estimate.duration_min} min)</strong>
                  </div>
                  <div style={styles.estimateRow}>
                    <span>Prise en charge camion benne</span>
                    <span>{estimate.breakdown?.base_fee?.toLocaleString()} FCFA</span>
                  </div>
                  <div style={styles.estimateRow}>
                    <span>Transport au kilomètre</span>
                    <span>{estimate.breakdown?.distance_cost?.toLocaleString()} FCFA</span>
                  </div>
                </>
              )}

              <div style={styles.divider} />

              <div style={{ ...styles.estimateRow, ...styles.total }}>
                <span>TOTAL EN SÉQUESTRE</span>
                <strong style={styles.totalAmount}>
                  {estimate.total_amount?.toLocaleString()} FCFA
                </strong>
              </div>

              <div style={styles.commission}>
                🔒 <strong>Règle d'or du Séquestre LogiTruck :</strong>
                {orderType === 'RENTAL' && ' L\'argent reste bloqué tant que l\'engin n\'a pas accompli les heures sur le chantier. Une fois validé par vous, 90% sont reversés au propriétaire.'}
                {orderType === 'EVACUATION' && ' L\'argent est libéré uniquement après dépôt vérifié à la décharge et confirmation que votre chantier est débarrassé.'}
                {orderType === 'MATERIAL' && ' L\'argent est débloqué au chauffeur uniquement après déchargement et vérification des matériaux sur votre chantier.'}
              </div>
            </div>

            <div style={styles.paymentInfo}>
              <p><strong>Paiement instantané par Mobile Money (MTN MoMo / Moov Money)</strong></p>
              <p style={styles.paymentSub}>
                Paiement sécurisé via KKiaPay. Les chauffeurs reçoivent la mission dès confirmation du séquestre.
              </p>
            </div>

            <div style={styles.btnGroup}>
              <button onClick={() => setStep(1)} style={styles.secondaryBtn}>
                ← Modifier
              </button>
              <button onClick={confirmOrder} disabled={loading} style={styles.primaryBtn}>
                {loading ? 'Initialisation...' : `Bloquer en séquestre (${estimate.total_amount?.toLocaleString()} FCFA)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '22px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B', marginBottom: '12px' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#F8F9FA' },
  header: { background: '#1E293B', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', color: 'white' },
  back: { background: 'none', border: 'none', color: 'white', fontSize: '15px', cursor: 'pointer', fontWeight: '600' },
  title: { color: 'white', fontSize: '18px', fontWeight: '800', margin: 0 },
  content: { padding: '24px 20px', maxWidth: '640px', margin: '0 auto' },
  tabs: { display: 'flex', gap: '10px', marginBottom: '24px' },
  tabBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
  },
  form: { display: 'flex', flexDirection: 'column' },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '14.5px',
    width: '100%',
    boxSizing: 'border-box',
    background: 'white',
    color: '#1E293B',
  },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  primaryBtn: {
    padding: '16px',
    background: '#FF6B00',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '800',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 12px rgba(255,107,0,0.25)',
  },
  secondaryBtn: {
    padding: '16px',
    background: 'white',
    color: '#475569',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    flex: 1,
  },
  estimate: { display: 'flex', flexDirection: 'column', gap: '20px' },
  estimateTitle: { fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 },
  estimateCard: { background: 'white', borderRadius: '14px', padding: '22px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0' },
  estimateRow: { display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: '14.5px', color: '#334155' },
  divider: { height: '1px', background: '#E2E8F0', margin: '10px 0' },
  total: { fontSize: '18px', fontWeight: '800', color: '#0F172A' },
  totalAmount: { color: '#FF6B00', fontSize: '24px' },
  commission: { background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px 14px', borderRadius: '10px', fontSize: '13px', color: '#166534', marginTop: '14px', lineHeight: '1.5' },
  paymentInfo: { background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '14px', fontSize: '13.5px', color: '#9A3412' },
  paymentSub: { color: '#C2410C', margin: '4px 0 0', fontSize: '12.5px' },
  btnGroup: { display: 'flex', gap: '12px' },
};
