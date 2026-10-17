import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { payOrder } from '../services/kkiapay';

// Cotonou comme centre par défaut
const DEFAULT_PICKUP = { lat: 6.3703, lng: 2.3912, address: 'Carrière de Tori-Bossito' };
const DEFAULT_DELIVERY = { lat: 6.3654, lng: 2.4183, address: 'Akpakpa, Cotonou' };

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: formulaire, 2: estimation, 3: confirmation
  const [form, setForm] = useState({
    pickup_lat: DEFAULT_PICKUP.lat,
    pickup_lng: DEFAULT_PICKUP.lng,
    pickup_address: DEFAULT_PICKUP.address,
    delivery_lat: DEFAULT_DELIVERY.lat,
    delivery_lng: DEFAULT_DELIVERY.lng,
    delivery_address: DEFAULT_DELIVERY.address,
    truck_type: 'double_benne',
    quantity_m3: 10,
    material_description: 'Gravier concassé 15/25',
  });
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const getEstimate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/orders/estimate', {
        pickup_lat: form.pickup_lat,
        pickup_lng: form.pickup_lng,
        delivery_lat: form.delivery_lat,
        delivery_lng: form.delivery_lng,
        truck_type: form.truck_type,
      });
      setEstimate(data);
      setStep(2);
    } catch (err) {
      // géré par intercepteur
    } finally {
      setLoading(false);
    }
  };

  // Commande + paiement en une seule étape : l'argent est bloqué sur LogiTruck, pas versé au chauffeur
  const confirmOrder = async () => {
    setLoading(true);
    let orderId;
    try {
      const { data } = await api.post('/orders', form);
      orderId = data.order.id;
      const res = await payOrder(orderId);
      if (res.ok) {
        toast.success('Paiement sécurisé ! Un chauffeur va accepter sous peu.');
      } else {
        toast('Paiement non finalisé : vous pouvez le reprendre depuis votre commande.', { icon: 'ℹ️' });
      }
    } catch (err) {
      // erreurs réseau/validation affichées par l'intercepteur ; sinon message du module de paiement
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
        <h2 style={styles.title}>Nouvelle commande</h2>
      </header>

      <div style={styles.content}>
        {step === 1 && (
          <form onSubmit={getEstimate} style={styles.form}>
            <Section title="Point de chargement (carrière)">
              <Field label="Adresse de la carrière">
                <input name="pickup_address" value={form.pickup_address}
                  onChange={handleChange} style={styles.input} required />
              </Field>
              <div style={styles.row}>
                <Field label="Latitude">
                  <input name="pickup_lat" type="number" step="0.000001"
                    value={form.pickup_lat} onChange={handleChange} style={styles.input} required />
                </Field>
                <Field label="Longitude">
                  <input name="pickup_lng" type="number" step="0.000001"
                    value={form.pickup_lng} onChange={handleChange} style={styles.input} required />
                </Field>
              </div>
            </Section>

            <Section title="Point de livraison (chantier)">
              <Field label="Adresse du chantier">
                <input name="delivery_address" value={form.delivery_address}
                  onChange={handleChange} style={styles.input} required />
              </Field>
              <div style={styles.row}>
                <Field label="Latitude">
                  <input name="delivery_lat" type="number" step="0.000001"
                    value={form.delivery_lat} onChange={handleChange} style={styles.input} required />
                </Field>
                <Field label="Longitude">
                  <input name="delivery_lng" type="number" step="0.000001"
                    value={form.delivery_lng} onChange={handleChange} style={styles.input} required />
                </Field>
              </div>
            </Section>

            <Section title="Matériaux">
              <Field label="Type de camion">
                <select name="truck_type" value={form.truck_type}
                  onChange={handleChange} style={styles.input}>
                  <option value="simple_benne">Benne simple</option>
                  <option value="double_benne">Double benne (+40%)</option>
                  <option value="plateau">Plateau</option>
                </select>
              </Field>
              <Field label="Quantité estimée (m³)">
                <input name="quantity_m3" type="number" min="1" step="0.5"
                  value={form.quantity_m3} onChange={handleChange} style={styles.input} required />
              </Field>
              <Field label="Description du matériau">
                <input name="material_description" value={form.material_description}
                  onChange={handleChange} style={styles.input}
                  placeholder="Ex: Gravier concassé 15/25" />
              </Field>
            </Section>

            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Calcul en cours...' : 'Obtenir le prix'}
            </button>
          </form>
        )}

        {step === 2 && estimate && (
          <div style={styles.estimate}>
            <h3 style={styles.estimateTitle}>Estimation du prix</h3>

            <div style={styles.estimateCard}>
              <div style={styles.estimateRow}>
                <span>Distance</span>
                <strong>{estimate.distance_km} km</strong>
              </div>
              <div style={styles.estimateRow}>
                <span>Durée estimée</span>
                <strong>{estimate.duration_min} min</strong>
              </div>
              <div style={styles.divider} />
              <div style={styles.estimateRow}>
                <span>Frais de chargement</span>
                <span>{estimate.breakdown?.loading_fee?.toLocaleString()} FCFA</span>
              </div>
              <div style={styles.estimateRow}>
                <span>Transport</span>
                <span>{estimate.breakdown?.distance_cost?.toLocaleString()} FCFA</span>
              </div>
              <div style={styles.divider} />
              <div style={{ ...styles.estimateRow, ...styles.total }}>
                <span>TOTAL À PAYER</span>
                <strong style={styles.totalAmount}>
                  {estimate.total_amount?.toLocaleString()} FCFA
                </strong>
              </div>
              <div style={styles.commission}>
                {estimate.driver_amount?.toLocaleString()} FCFA versés au chauffeur après livraison
              </div>
            </div>

            <div style={styles.paymentInfo}>
              <p><strong>Paiement sécurisé via KKiaPay — vous payez maintenant</strong></p>
              <p style={styles.paymentSub}>
                Votre argent est bloqué sur LogiTruck : il ne va PAS directement au chauffeur.
                Vous suivez le camion en direct, puis vous confirmez la réception : seulement alors
                le chauffeur est payé (90 %) et LogiTruck prélève ses 10 %. MTN MoMo et Moov Money acceptés.
              </p>
            </div>

            <div style={styles.btnGroup}>
              <button onClick={() => setStep(1)} style={styles.secondaryBtn}>
                ← Modifier
              </button>
              <button onClick={confirmOrder} disabled={loading} style={styles.primaryBtn}>
                {loading ? 'Paiement en cours…' : `Commander et payer ${estimate.total_amount?.toLocaleString('fr-FR')} FCFA`}
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
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#333', marginBottom: '12px' }}>
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
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  header: { background: '#FF6B00', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' },
  back: { background: 'none', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer' },
  title: { color: 'white', fontSize: '18px', fontWeight: '700', margin: 0 },
  content: { padding: '20px', maxWidth: '600px', margin: '0 auto' },
  form: { display: 'flex', flexDirection: 'column' },
  input: { padding: '11px 14px', borderRadius: '8px', border: '2px solid #eee', fontSize: '15px', width: '100%', boxSizing: 'border-box' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  primaryBtn: { padding: '15px', background: '#FF6B00', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%' },
  secondaryBtn: { padding: '15px', background: 'white', color: '#FF6B00', border: '2px solid #FF6B00', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', flex: 1 },
  estimate: { display: 'flex', flexDirection: 'column', gap: '20px' },
  estimateTitle: { fontSize: '20px', fontWeight: '800', color: '#333', margin: 0 },
  estimateCard: { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  estimateRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '15px' },
  divider: { height: '1px', background: '#eee', margin: '8px 0' },
  total: { fontSize: '18px', fontWeight: '700' },
  totalAmount: { color: '#FF6B00', fontSize: '22px' },
  commission: { background: '#E8F5E9', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: '#2E7D32', marginTop: '8px' },
  paymentInfo: { background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: '10px', padding: '14px', fontSize: '14px' },
  paymentSub: { color: '#555', margin: '4px 0 0', fontSize: '13px' },
  btnGroup: { display: 'flex', gap: '12px' },
};
