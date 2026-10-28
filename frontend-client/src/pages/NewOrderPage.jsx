import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Check, LocateFixed, Phone, Search, Truck } from 'lucide-react';
import api from '../services/api';
import { payOrder } from '../services/kkiapay';
import { getSocket } from '../services/socket';
import OrderMap from '../components/OrderMap';
import { STATUS, Track, describe } from '../components/delivery';
import '../styles/order.css';

const DEFAULT_COTONOU = { lat: 6.3654, lng: 2.4183, address: 'Cotonou, Bénin' };
const DEFAULT_CARRIERE = { lat: 6.5050, lng: 2.3050, address: 'Carrière de Tori-Bossito' };
const DEFAULT_DECHARGE = { lat: 6.4800, lng: 2.3500, address: 'Décharge contrôlée d\'Akassato' };

const SERVICES = [
  { type: 'MATERIAL', label: 'Matériaux' },
  { type: 'RENTAL', label: 'Engins' },
  { type: 'EVACUATION', label: 'Gravats' },
];

// Statuts où la commande attend encore un chauffeur
const WAITING = ['pending', 'awaiting_payment'];
const STEPS = ['Commande', 'Adresses', 'Devis'];
// Les sections du formulaire ne s'affichent qu'à leur étape (1 : commande, 2 : adresses)
const FormStep = React.createContext(1);

/** Les trois étapes de la commande, en haut du volet. */
function OrderSteps({ step }) {
  return (
    <ol className="bn-order__steps" aria-label="Étapes de la commande">
      {STEPS.map((label, i) => (
        <li key={label} className={i + 1 < step ? 'is-done' : i + 1 === step ? 'is-current' : ''} aria-current={i + 1 === step ? 'step' : undefined}>
          <span>{i + 1 < step ? <Check size={12} strokeWidth={3.5} aria-hidden="true" /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

/** Étape 3 : commande payée, recherche d'un chauffeur, la carte reste affichée. */
function DriverSearch({ order }) {
  return (
    <div className="bn-order__waiting" role="status">
      <span className="bn-order__radar" aria-hidden="true"><Truck size={26} /></span>
      <strong>Recherche d'un chauffeur…</strong>
      <p>Commande {order.order_number} payée : {Number(order.total_amount || 0).toLocaleString('fr-FR')} FCFA. Le suivi s'ouvre dès qu'un chauffeur accepte.</p>
      <Track status="pending" />
      <Link to={`/orders/${order.id}`} className="bn-order__cta bn-order__cta--ghost">Voir la commande</Link>
    </div>
  );
}

/** Livraison en cours en haut du volet : chauffeur, appel, frise de progression. */
function CurrentDelivery({ order }) {
  const initials = (order.driver_name || 'BG').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <div className="bn-order__current">
      <div className="bn-order__driver">
        <span className="bn-order__avatar" aria-hidden="true">{initials}</span>
        <Link to={`/orders/${order.id}`} className="bn-order__who">
          <small>{order.driver_name ? 'Chauffeur' : 'Commande en cours'}</small>
          <strong>{order.driver_name || order.order_number}</strong>
        </Link>
        {order.driver_phone && (
          <a className="bn-order__call" href={`tel:${order.driver_phone}`} aria-label={`Appeler ${order.driver_name}`}>
            <Phone size={18} aria-hidden="true" />
          </a>
        )}
      </div>
      <p className="bn-order__note"><i aria-hidden="true" />{describe(order)} · {STATUS[order.status]?.label || order.status}</p>
      <Track status={order.status} />
    </div>
  );
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') || 'MATERIAL';

  const [orderType, setOrderType] = useState(initialType);
  // 1 : commande, 2 : adresses, 3 : devis, 4 : recherche du chauffeur (après paiement)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [projects, setProjects] = useState([]);

  // Formulaire unifié & dynamique
  const [form, setForm] = useState({
    order_type: initialType,
    project_id: '',
    vehicle_type_id: '',

    // 1. Matériaux
    material_type_id: '',
    quantity_m3: 16,
    // Prérempli depuis les tuiles de l'accueil (?matiere=Sable)
    material_description: searchParams.get('matiere') || '',
    truck_type: 'double_benne',
    pickup_address: DEFAULT_CARRIERE.address,
    pickup_lat: DEFAULT_CARRIERE.lat,
    pickup_lng: DEFAULT_CARRIERE.lng,
    delivery_address: DEFAULT_COTONOU.address,
    delivery_lat: DEFAULT_COTONOU.lat,
    delivery_lng: DEFAULT_COTONOU.lng,

    // 2. Location Engins
    machinery_type: 'excavatrice',
    duration_hours: 8,
    rental_start_date: new Date().toISOString().split('T')[0],

    // 3. Évacuation Gravats
    evacuation_debris_type: 'Gravats de démolition et béton',
    evacuation_photo_url: '',
    rotations: 2,
    notes: '',
  });

  const [estimate, setEstimate] = useState(null);

  // Livraison en cours, montrée en haut du volet comme sur la maquette
  const [current, setCurrent] = useState(null);
  const paramsRef = useRef(null);
  useEffect(() => {
    api.get('/orders')
      .then(({ data }) => setCurrent((data.orders || []).find((o) => (STATUS[o.status]?.group || 'done') === 'active') || null))
      .catch(() => {});
  }, []);
  const [placed, setPlaced] = useState(null);

  // Chaque étape repart du haut du volet
  const bodyRef = useRef(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);
  const nextStep = (e) => {
    e.preventDefault();
    setStep(2);
  };

  // Bouton « ma position » : place le point modifiable (chantier ou ramassage) sur la position du téléphone
  const locate = (which) => {
    if (!navigator.geolocation) return toast.error('Position indisponible sur cet appareil');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setForm((prev) => ({ ...prev, [`${which}_lat`]: coords.latitude, [`${which}_lng`]: coords.longitude })),
      () => toast.error('Activez la localisation pour utiliser votre position'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) navigate('/orders');
    else navigate(-1);
  };

  // Étape 3 : dès qu'un chauffeur accepte (temps réel ou relevé toutes les 5 s), on ouvre le suivi
  useEffect(() => {
    if (step !== 4 || !placed) return undefined;
    let done = false;
    const open = (event) => {
      if (done || (event?.order_id && event.order_id !== placed.id)) return;
      done = true;
      toast.success('Un chauffeur a accepté votre commande');
      navigate(`/orders/${placed.id}`, { replace: true });
    };
    const check = () => api.get(`/orders/${placed.id}`)
      .then(({ data }) => { if (!WAITING.includes((data.order || data).status)) open(); })
      .catch(() => {});
    const timer = setInterval(check, 5000);
    const socket = getSocket();
    socket?.emit('track_order', placed.id);
    socket?.on('order_accepted', open);
    return () => { clearInterval(timer); socket?.off('order_accepted', open); };
  }, [step, placed]);

  const showParams = () => {
    paramsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    paramsRef.current?.querySelector('input, select')?.focus({ preventScroll: true });
  };

  // Code promo
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Commande récurrente
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('weekly');

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
      setStep(3);
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
            project_id: form.project_id || undefined,                                                                                                                                      
            vehicle_type_id: form.vehicle_type_id || undefined,                                                                                                                            
            material_type_id: form.material_type_id || undefined,                                                                                                                          
            promo_code: promoResult?.code || undefined,                                                                                                                                    
            is_recurring: isRecurring,                                                                                                                                                     
            recurring_frequency: isRecurring ? recurringFrequency : undefined,                                                                                                             
          };

      const { data } = await api.post('/orders', payload);
      orderId = data.order.id;

      // Déclenchement du paiement KKiaPay (MTN / Moov) bloqué en séquestre
      const res = await payOrder(orderId);
      if (res.ok) {
        // Étape 3 : on reste sur la carte jusqu'à ce qu'un chauffeur accepte
        setPlaced({ id: orderId, order_number: data.order.order_number, total_amount: data.order.total_amount });
        setStep(4);
        orderId = undefined;
      } else {
        toast('Paiement non finalisé : vous pouvez régler depuis votre espace de suivi.');
      }
    } catch (err) {
      if (err?.message && !err.response) toast.error(err.message);
    } finally {
      setLoading(false);
      if (orderId) navigate(`/orders/${orderId}`);
    }
  };

  // Les trois étapes se font sur la carte (design C), jusqu'à ce qu'un chauffeur accepte :
  // 1. paramètres (sous « Mes commandes » / « Nouvelle commande »), 2. devis, 3. recherche du chauffeur
  {
    const editable = orderType === 'EVACUATION' ? 'pickup' : 'delivery';
    const searchField = editable === 'pickup' ? 'pickup_address' : 'delivery_address';
    return (
      <div className="bn-order">
        <div className="bn-order__map">
          <OrderMap
            pickup={{ lat: form.pickup_lat, lng: form.pickup_lng }}
            delivery={{ lat: form.delivery_lat, lng: form.delivery_lng }}
            showPickup={orderType !== 'RENTAL'}
            editable={editable}
            onChange={(which, { lat, lng }) => setForm((prev) => ({ ...prev, [`${which}_lat`]: lat, [`${which}_lng`]: lng }))}
          />
          <button type="button" className="bn-order__locate" onClick={() => locate(editable)} aria-label="Utiliser ma position">
            <LocateFixed size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="bn-order__top">
          <button type="button" className="bn-order__round" onClick={goBack} aria-label="Retour">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <label className="bn-order__search">
            <Search size={18} aria-hidden="true" />
            <input
              name={searchField}
              value={form[searchField]}
              onChange={handleChange}
              placeholder={editable === 'pickup' ? 'Où ramasser ?' : 'Où livrer ?'}
              aria-label={editable === 'pickup' ? 'Adresse du chantier à nettoyer' : 'Adresse de livraison'}
            />
          </label>
        </div>

        <section className="bn-order__sheet">
          <span className="bn-order__grab" aria-hidden="true" />
          {step <= 3 && <OrderSteps step={step} />}

          <div className="bn-order__body" ref={bodyRef}>
          {step <= 2 && (
            <>
            {step === 1 && current && <CurrentDelivery order={current} />}

            {step === 1 && (
              <div className="bn-order__ctas">
                <Link to="/orders" className="bn-order__cta bn-order__cta--ghost">Mes commandes</Link>
                <button type="button" className="bn-order__cta bn-order__cta--gold" onClick={showParams}>Nouvelle commande</button>
              </div>
            )}

              <FormStep.Provider value={step}>
              <form ref={paramsRef} onSubmit={step === 1 ? nextStep : getEstimate} style={styles.form} aria-label="Paramètres de la commande">
                {step === 1 && (
                <div className="bn-order__services" role="radiogroup" aria-label="Service">
                  {SERVICES.map((sv) => (
                    <button
                      key={sv.type}
                      type="button"
                      role="radio"
                      aria-checked={orderType === sv.type}
                      className={`bn-order__service${orderType === sv.type ? ' is-active' : ''}`}
                      onClick={() => handleTypeSelect(sv.type)}
                    >
                      {sv.label}
                    </button>
                  ))}
                </div>
                )}
                {/* Rattachement à un chantier B2B optionnel */}
                {projects.length > 0 && (
                  <Section part={2} title="Chantier entreprise (facultatif)">
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
                    <Section part={1} title="Matériaux & Camion">
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
                            <option value="pickup">Pick-up / camionnette (sacs, ciment, briques)</option>
                            <option value="double_benne">Camion Benne 16m³ (Double benne)</option>
                            <option value="semi_remorque">Semi-remorque Benne (25m³)</option>
                            <option value="plateau">Camion Plateau (Briques/Fer)</option>
                            <option value="grue">Camion avec Grue embarquée</option>
                          </select>
                        </Field>
                      </div>
                    </Section>

                    <Section part={2} title="Itinéraire de Livraison">
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
                    </Section>
                  </>
                )}

                {/* CAS 2 : LOCATION D'ENGINS LOURDS */}
                {orderType === 'RENTAL' && (
                  <>
                    <Section part={1} title="Sélection de l'Engin Lourd">
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

                    <Section part={2} title="Chantier de déploiement de l'engin">
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
                    </Section>
                  </>
                )}

                {/* CAS 3 : ÉVACUATION DE GRAVATS */}
                {orderType === 'EVACUATION' && (
                  <>
                    <Section part={1} title="Débris & Volume à Évacuer">
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

                    <Section part={2} title="Points de Ramassage et de Décharge">
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

                <div className="bn-order__footer">
                  {step === 2 && (
                    <button type="button" onClick={() => setStep(1)} style={styles.secondaryBtn}>
                      <ArrowLeft size={16} aria-hidden="true" /> Retour
                    </button>
                  )}
                  <button type="submit" disabled={loading} style={styles.primaryBtn}>
                    {step === 1 ? <>Suivant : adresses <ArrowRight size={16} aria-hidden="true" /></>
                      : loading ? 'Calcul du devis…' : <>Voir le devis <ArrowRight size={16} aria-hidden="true" /></>}
                  </button>
                </div>
              </form>
              </FormStep.Provider>
            </>
          )}

          {step === 3 && estimate && (
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
                  <strong>Règle d'or du Séquestre BenneGo :</strong>
                  {orderType === 'RENTAL' && ' L\'argent reste bloqué tant que l\'engin n\'a pas accompli les heures sur le chantier. Une fois validé par vous, le propriétaire est payé.'}
                  {orderType === 'EVACUATION' && ' L\'argent est libéré uniquement après dépôt vérifié à la décharge et confirmation que votre chantier est débarrassé.'}
                  {orderType === 'MATERIAL' && ' L\'argent est débloqué au chauffeur uniquement après déchargement et vérification des matériaux sur votre chantier.'}
                </div>
              </div>

                                                                                                                                                                           
                  {/* Promo & Commande récurrente */}                                                                                                                                        
                  <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>                                                                
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>                                                                                                      
                      <input                                                                                                                                                                 
                        type="text"                                                                                                                                                          
                        placeholder="Code Promo (ex: BIENVENUE10)"                                                                                                                           
                        value={promoCode}                                                                                                                                                    
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}                                                                                                         
                        style={{ ...styles.input, textTransform: 'uppercase', flex: 1 }}                                                                                                     
                      />                                                                                                                                                                     
                      <button                                                                                                                                                                
                        type="button"                                                                                                                                                        
                        onClick={async () => {                                                                                                                                               
                          if (!promoCode.trim()) return;                                                                                                                                     
                          setPromoLoading(true);                                                                                                                                             
                          try {                                                                                                                                                              
                            const { data } = await api.post('/promo/validate', {                                                                                                             
                              code: promoCode,                                                                                                                                               
                              order_amount: estimate?.total_amount || 0,                                                                                                                     
                            });                                                                                                                                                              
                            setPromoResult(data);                                                                                                                                            
                            toast.success(data.message);                                                                                                                                     
                          } catch {                                                                                                                                                          
                            setPromoResult(null);                                                                                                                                            
                          } finally {                                                                                                                                                        
                            setPromoLoading(false);                                                                                                                                          
                          }                                                                                                                                                                  
                        }}                                                                                                                                                                   
                        disabled={promoLoading}                                                                                                                                              
                        style={{ ...styles.primaryBtn, width: 'auto', padding: '0 16px', fontSize: '13.5px' }}                                                                               
                      >                                                                                                                                                                      
                        Appliquer                                                                                                                                                            
                      </button>                                                                                                                                                              
                    </div>                                                                                                                                                                   
                                                                                                                                                                                           
                    {promoResult && (                                                                                                                                                        
                      <p style={{ color: 'var(--success)', fontSize: '13px', fontWeight: '700', margin: '0 0 10px' }}>                                                                              
                        Remise déduite : -{promoResult.discount_amount.toLocaleString()} FCFA                                                                                                
                      </p>                                                                                                                                                                   
                    )}                                                                                                                                                                       
                                                                                                                                                                                           
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', color: 'var(--text)' }}>                                           
                      <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />                                                                     
                      Planifier comme commande récurrente de chantier                                                                                                                        
                    </label>                                                                                                                                                                 
                                                                                                                                                                                           
                    {isRecurring && (                                                                                                                                                        
                      <select value={recurringFrequency} onChange={(e) => setRecurringFrequency(e.target.value)} style={{ ...styles.input, marginTop: '8px' }}>                              
                        <option value="daily">Quotidien (chaque jour)</option>                                                                                                               
                        <option value="weekly">Hebdomadaire (chaque semaine)</option>                                                                                                        
                        <option value="biweekly">Bihebdomadaire (toutes les 2 semaines)</option>                                                                                             
                        <option value="monthly">Mensuel (chaque mois)</option>                                                                                                               
                      </select>                                                                                                                                                              
                    )}                                                                                                                                                                       
                  </div>

              <div style={styles.paymentInfo}>
                <p><strong>Paiement instantané par Mobile Money (MTN MoMo / Moov Money)</strong></p>
                <p style={styles.paymentSub}>
                  Paiement sécurisé via KKiaPay. Les chauffeurs reçoivent la mission dès confirmation du séquestre.
                </p>
              </div>

              <div style={styles.btnGroup} className="bn-order__footer">
                <button onClick={() => setStep(2)} style={styles.secondaryBtn}>
                  <ArrowLeft size={16} aria-hidden="true" /> Modifier
                </button>
                <button onClick={confirmOrder} disabled={loading} style={styles.primaryBtn}>
                  {loading ? 'Commande en cours…' : 'Commander'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && placed && <DriverSearch order={placed} />}
          </div>
        </section>
      </div>
    );
  }
}

function Section({ title, part = 1, children }) {
  if (React.useContext(FormStep) !== part) return null;
  return (
    <div style={{ marginBottom: '20px' }}>
      <h3 style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 10px' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </div>
  );
}

// Le libellé enveloppe le champ : il devient son nom accessible (lecteurs d'écran, WCAG 1.3.1 / 4.1.2)
function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' }}>{label}</span>
      {children}
    </label>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'var(--bg)' },
  header: { background: 'var(--surface)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-strong)' },
  back: { background: 'none', border: 'none', color: 'var(--text-strong)', fontSize: '15px', cursor: 'pointer', fontWeight: '600' },
  title: { color: 'var(--text-strong)', fontSize: '18px', fontWeight: '800', margin: 0 },
  content: { padding: '24px 20px', maxWidth: '640px', margin: '0 auto' },
  tabs: { display: 'flex', gap: '10px', marginBottom: '24px' },
  tabBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
  },
  form: { display: 'flex', flexDirection: 'column' },
  input: {
    minHeight: '50px',
    padding: '0 14px',
    borderRadius: '14px',
    border: '1.5px solid transparent',
    fontSize: '15px',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    background: 'var(--surface-2)',
    color: 'var(--text-strong)',
  },
  row: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', alignItems: 'end' },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '54px',
    padding: '0 16px',
    background: 'var(--brand-grad)',
    color: '#0b0b10',
    border: 'none',
    borderRadius: '16px',
    fontSize: '16px',
    fontWeight: '800',
    cursor: 'pointer',
    width: '100%',
    boxShadow: 'var(--shadow-brand)',
  },
  secondaryBtn: {
    padding: '16px',
    background: 'var(--surface)',
    color: 'var(--text-2)',
    border: '1px solid var(--border-2)',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    flex: 1,
  },
  estimate: { display: 'flex', flexDirection: 'column', gap: '20px' },
  estimateTitle: { fontSize: '20px', fontWeight: '800', color: 'var(--text-strong)', margin: 0 },
  estimateCard: { background: 'var(--surface)', borderRadius: '14px', padding: '22px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid var(--border)' },
  estimateRow: { display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: '14.5px', color: 'var(--text)' },
  divider: { height: '1px', background: 'var(--surface-3)', margin: '10px 0' },
  total: { fontSize: '18px', fontWeight: '800', color: 'var(--text-strong)' },
  totalAmount: { color: 'var(--brand-ink)', fontSize: '24px' },
  commission: { background: 'var(--success-soft)', border: '1px solid rgba(34, 197, 94, 0.35)', padding: '12px 14px', borderRadius: '10px', fontSize: '13px', color: 'var(--success)', marginTop: '14px', lineHeight: '1.5' },
  paymentInfo: { background: 'var(--warning-soft)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '10px', padding: '14px', fontSize: '13.5px', color: 'var(--warning)' },
  paymentSub: { color: 'var(--warning)', margin: '4px 0 0', fontSize: '12.5px' },
  btnGroup: { display: 'flex', gap: '12px' },
};
