import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Bell, BellOff, ChevronRight, Eye, KeyRound, Laptop, LockKeyhole, MapPin, Moon, Phone, ShieldCheck,
  Smartphone, Trash2, UserRound, Volume2, Vibrate, Languages, Check,
} from 'lucide-react';
import { LANGUAGES } from './i18n/engine';
import { currentLanguage, setLanguage } from './i18n/dom';
import { pushState, enablePush, disablePush } from './messaging';
import { useAccountSettings } from './accountSettings';
import './settings.css';

// Types de notifications : libellé et précision, selon le rôle (les clés viennent du serveur)
const CATEGORY_TEXT = {
  order_updates: ['Suivi de mes commandes', 'Acceptée, en route, livrée'],
  messages: ['Messages', 'Discussions de vos commandes'],
  promotions: ['Promotions', 'Offres et codes promo'],
  new_orders: ['Nouvelles courses', 'Courses disponibles quand vous êtes en ligne'],
  earnings: ['Gains', 'Paiements validés et versements'],
  disputes: ['Litiges', 'Nouveaux litiges à trancher'],
  reliefs: ['Pannes & relèves', "Camion en panne pendant une course"],
  payouts: ['Versements', 'Demandes de versement du crédit'],
};
const ADMIN_MESSAGES = ['Messages des litiges', 'Nouveaux messages dans un litige ouvert'];

const PRIVACY_TEXT = {
  client: {
    show_photo: ['Photo visible du camionneur', 'Il vous reconnaît à la livraison'],
    hide_phone: ['Masquer mon numéro', 'Le camionneur vous écrit par la messagerie de la commande'],
  },
  driver: {
    show_photo: ['Photo visible du client', 'Il vous reconnaît à votre arrivée'],
    hide_phone: ['Masquer mon numéro', 'Le client vous écrit par la messagerie de la course'],
  },
};

const DEVICE_PUSH_TEXT = {
  on: 'Activées sur cet appareil',
  off: "Recevoir les alertes même l'application fermée",
  denied: 'Bloquées : autorisez-les dans les réglages du téléphone',
  unsupported: "Sur iPhone : ajoutez d'abord l'app à l'écran d'accueil",
  loading: '…',
};

const day = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const ago = (d) => {
  const minutes = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (minutes < 5) return 'Actif maintenant';
  if (minutes < 60) return `Actif il y a ${minutes} min`;
  if (minutes < 1440) return `Actif il y a ${Math.round(minutes / 60)} h`;
  return `Actif le ${new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
};

// Liste des réglages modifiés (chemins « notifications.messages », « notifications.quiet_hours.start »…)
const flatten = (obj, prefix = '') => Object.entries(obj || {}).flatMap(([k, v]) => (
  v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
));
const diffOf = (saved, draft) => {
  const before = Object.fromEntries(flatten(saved));
  return flatten(draft).filter(([k, v]) => before[k] !== v);
};
const patchOf = (changes) => {
  const patch = {};
  for (const [path, value] of changes) {
    const keys = path.split('.');
    let node = patch;
    keys.slice(0, -1).forEach((k) => { node[k] = node[k] || {}; node = node[k]; });
    node[keys.at(-1)] = value;
  }
  return patch;
};
const setIn = (obj, path, value) => {
  const [head, ...rest] = path;
  return { ...obj, [head]: rest.length ? setIn(obj?.[head] || {}, rest, value) : value };
};

function Toggle({ on, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={`bn-set-switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function Row({ icon: Icon, tone = 'brand', title, text, onClick, right, danger }) {
  const body = (
    <>
      <span className={`bn-set-row__icon bn-set-row__icon--${danger ? 'red' : tone}`}><Icon size={19} aria-hidden="true" /></span>
      <span className="bn-set-row__main">
        <strong>{title}</strong>
        {text && <small>{text}</small>}
      </span>
      {right ?? (onClick && <ChevronRight size={18} className="bn-set-row__chev" aria-hidden="true" />)}
    </>
  );
  const className = `bn-set-row${danger ? ' is-danger' : ''}`;
  return onClick
    ? <button type="button" className={className} onClick={onClick}>{body}</button>
    : <div className={className}>{body}</div>;
}

function Group({ title, children }) {
  return (
    <section className="bn-set-group">
      {title && <h2>{title}</h2>}
      <div className="bn-set-list">{children}</div>
    </section>
  );
}

function Head({ title, subtitle, onBack, big }) {
  return (
    <header className={`bn-set-head${big ? ' is-big' : ''}`}>
      <button type="button" className="bn-set-back" onClick={onBack} aria-label="Retour"><ArrowLeft size={20} aria-hidden="true" /></button>
      {big ? (
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      ) : <h1>{title}</h1>}
    </header>
  );
}

/** Notifications sur cet appareil (abonnement push du navigateur) : appliqué tout de suite. */
function DevicePush({ api }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setState); }, []);
  const toggle = async () => {
    if (busy || state === 'unsupported' || state === 'loading') return;
    if (state === 'denied') return toast('Les notifications sont bloquées pour BenneGo dans les réglages du téléphone.');
    setBusy(true);
    try {
      setState(state === 'on' ? await disablePush(api) : await enablePush(api));
    } catch {
      toast.error("Impossible d'activer les notifications sur cet appareil");
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <Row icon={state === 'on' ? Bell : BellOff} tone={state === 'on' ? 'green' : 'sand'} title="Sur cet appareil"
      text={busy ? '…' : DEVICE_PUSH_TEXT[state]}
      right={<Toggle on={state === 'on'} onChange={toggle} disabled={busy || state === 'unsupported'} label="Notifications sur cet appareil" />} />
  );
}

/** Aperçu d'une notification, comme dans la vidéo : reflète son, vibration et heures calmes. */
function Preview({ role, n }) {
  const sample = {
    client: ['Livraison en route', 'Votre camion de sable arrive dans 10 min.'],
    driver: ['Nouvelle course disponible', 'Carrière de Tori → Akpakpa · 40 500 FCFA'],
    admin: ['Nouveau litige', 'LT-2026-0412 : quantité livrée contestée'],
  }[role] || ['BenneGo', 'Nouvelle notification'];
  const muted = !n.push;
  return (
    <div className={`bn-set-preview${muted ? ' is-muted' : ''}`} aria-hidden="true">
      <span className="bn-set-preview__logo">B</span>
      <div>
        <strong>BenneGo <small>maintenant</small></strong>
        <span>{muted ? 'Notifications en pause' : `${sample[0]} · ${sample[1]}`}</span>
        <em>
          <span>{n.sound ? <Volume2 size={12} /> : <BellOff size={12} />} {n.sound ? 'Son' : 'Silencieux'}</span>
          <span><Vibrate size={12} /> {n.vibration ? 'Vibration' : 'Sans vibration'}</span>
          {n.quiet_hours?.enabled && <span><Moon size={12} /> {n.quiet_hours.start}–{n.quiet_hours.end}</span>}
        </em>
      </div>
    </div>
  );
}

function NotificationsPage({ api, role, categories, draft, set, onBack }) {
  const n = draft.notifications;
  const label = (c) => (role === 'admin' && c === 'messages' ? ADMIN_MESSAGES : CATEGORY_TEXT[c] || [c, '']);
  return (
    <>
      <Head big title="Notifications" subtitle="Choisissez ce qui mérite une alerte." onBack={onBack} />
      <Preview role={role} n={n} />
      <Group>
        <DevicePush api={api} />
        <Row icon={Bell} title="Notifications push" text={n.push ? 'Activées pour votre compte' : 'En pause : aucune alerte'}
          right={<Toggle on={n.push} onChange={(v) => set(['notifications', 'push'], v)} label="Notifications push" />} />
      </Group>
      <Group title="Me prévenir pour">
        {categories.map((c) => (
          <Row key={c} icon={Bell} tone="slate" title={label(c)[0]} text={label(c)[1]}
            right={<Toggle on={n[c] !== false} disabled={!n.push} onChange={(v) => set(['notifications', c], v)} label={label(c)[0]} />} />
        ))}
      </Group>
      <Group title="Son & vibration">
        <Row icon={Volume2} tone="slate" title="Son" text="Un son court à chaque alerte"
          right={<Toggle on={n.sound} onChange={(v) => set(['notifications', 'sound'], v)} label="Son" />} />
        <Row icon={Vibrate} tone="slate" title="Vibration" text="Le téléphone vibre à chaque alerte"
          right={<Toggle on={n.vibration} onChange={(v) => set(['notifications', 'vibration'], v)} label="Vibration" />} />
      </Group>
      <Group title="Heures calmes">
        <Row icon={Moon} tone="slate" title="Pas de son la nuit"
          text={role === 'admin' ? 'Alertes silencieuses, sauf pannes en cours de course' : 'Alertes silencieuses, sauf pendant une course en cours'}
          right={<Toggle on={n.quiet_hours.enabled} onChange={(v) => set(['notifications', 'quiet_hours', 'enabled'], v)} label="Heures calmes" />} />
        {n.quiet_hours.enabled && (
          <div className="bn-set-row bn-set-hours">
            <label>De <input type="time" value={n.quiet_hours.start} onChange={(e) => set(['notifications', 'quiet_hours', 'start'], e.target.value)} /></label>
            <label>à <input type="time" value={n.quiet_hours.end} onChange={(e) => set(['notifications', 'quiet_hours', 'end'], e.target.value)} /></label>
          </div>
        )}
      </Group>
    </>
  );
}

function PrivacyPage({ role, draft, set, onBack }) {
  const texts = PRIVACY_TEXT[role] || {};
  return (
    <>
      <Head big title="Confidentialité" subtitle="Ce que voit l'autre personne de la commande." onBack={onBack} />
      <Group title="Profil">
        <Row icon={UserRound} tone="slate" title={texts.show_photo?.[0]} text={texts.show_photo?.[1]}
          right={<Toggle on={draft.privacy.show_photo} onChange={(v) => set(['privacy', 'show_photo'], v)} label={texts.show_photo?.[0]} />} />
        <Row icon={Phone} tone="slate" title={texts.hide_phone?.[0]}
          text={draft.privacy.hide_phone ? texts.hide_phone?.[1] : 'Numéro visible seulement pendant la course'}
          right={<Toggle on={draft.privacy.hide_phone} onChange={(v) => set(['privacy', 'hide_phone'], v)} label={texts.hide_phone?.[0]} />} />
      </Group>
      {role === 'driver' && (
        <Group title="Position">
          <Row icon={MapPin} tone="green" title="Seulement en ligne"
            text="Votre position n'est enregistrée que lorsque vous êtes en ligne ou en course. Hors ligne, rien n'est partagé." />
        </Group>
      )}
      <p className="bn-set-note"><Eye size={14} aria-hidden="true" /> L'équipe BenneGo garde accès à vos coordonnées pour l'assistance et les litiges.</p>
    </>
  );
}

function PasswordForm({ api }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) return toast.error('Les deux nouveaux mots de passe sont différents');
    setBusy(true);
    try {
      const { data } = await api.post('/account/password', { current_password: form.current, new_password: form.next });
      toast.success(data.message);
      setForm({ current: '', next: '', confirm: '' });
      setOpen(false);
    } catch { /* message affiché par l'intercepteur */ } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <>
      <Row icon={KeyRound} title="Mot de passe" text="Les autres appareils seront déconnectés" onClick={() => setOpen(!open)} />
      {open && (
        <form className="bn-set-form" onSubmit={submit}>
          <input type="password" autoComplete="current-password" placeholder="Mot de passe actuel" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required />
          <input type="password" autoComplete="new-password" placeholder="Nouveau (8 caractères minimum)" minLength={8} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required />
          <input type="password" autoComplete="new-password" placeholder="Confirmer le nouveau" minLength={8} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
          <button type="submit" className="bn-set-btn" disabled={busy}>{busy ? '…' : 'Changer le mot de passe'}</button>
        </form>
      )}
    </>
  );
}

function PhoneForm({ api, phone, onPhone }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ phone: '', code: '', password: '' });
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/account/phone/request', { phone: form.phone.trim() });
      toast.success('Code envoyé par SMS au nouveau numéro');
      setStep(2);
    } catch { /* intercepteur */ } finally { setBusy(false); }
  };
  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/account/phone/confirm', { phone: form.phone.trim(), code: form.code.trim(), password: form.password });
      toast.success(data.message);
      onPhone?.(data.phone);
      setOpen(false);
      setStep(1);
      setForm({ phone: '', code: '', password: '' });
    } catch { /* intercepteur */ } finally { setBusy(false); }
  };
  return (
    <>
      <Row icon={Smartphone} title="Numéro de téléphone" text={phone || 'Changer de numéro avec un code SMS'} onClick={() => setOpen(!open)} />
      {open && (step === 1 ? (
        <form className="bn-set-form" onSubmit={send}>
          <input type="tel" inputMode="tel" placeholder="Nouveau numéro (+229…)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <button type="submit" className="bn-set-btn" disabled={busy}>{busy ? '…' : 'Recevoir un code'}</button>
        </form>
      ) : (
        <form className="bn-set-form" onSubmit={confirm}>
          <input inputMode="numeric" maxLength={6} placeholder="Code reçu (6 chiffres)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input type="password" autoComplete="current-password" placeholder="Votre mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <button type="submit" className="bn-set-btn" disabled={busy}>{busy ? '…' : 'Changer de numéro'}</button>
        </form>
      ))}
    </>
  );
}

function Devices({ api }) {
  const [list, setList] = useState(null);
  const load = () => api.get('/account/sessions').then(({ data }) => setList(data.sessions)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const revoke = async (id) => {
    try { await api.delete(`/account/sessions/${id}`); toast.success('Appareil déconnecté'); load(); } catch { /* intercepteur */ }
  };
  const revokeOthers = async () => {
    if (!window.confirm('Déconnecter tous les autres appareils ?')) return;
    try { const { data } = await api.post('/account/sessions/revoke-others'); toast.success(data.message); load(); } catch { /* intercepteur */ }
  };
  const others = (list || []).filter((s) => !s.current);
  return (
    <Group title="Appareils connectés">
      {list === null && <div className="bn-set-row"><small>Chargement…</small></div>}
      {(list || []).map((s) => (
        <Row key={s.id} icon={/Windows|Mac|Linux|Chrome|Firefox|Edge|Safari/.test(s.device_label || '') && !/Android|iPhone/.test(s.device_label || '') ? Laptop : Smartphone}
          tone={s.current ? 'green' : 'slate'} title={s.device_label || 'Appareil'}
          text={s.current ? 'Cet appareil' : ago(s.last_seen_at)}
          right={s.current ? null : <button type="button" className="bn-set-link" onClick={() => revoke(s.id)}>Déconnecter</button>} />
      ))}
      {others.length > 0 && (
        <button type="button" className="bn-set-row bn-set-row--action" onClick={revokeOthers}>Déconnecter tous les autres appareils</button>
      )}
    </Group>
  );
}

function SecurityPage({ api, phone, onPhone, onBack }) {
  return (
    <>
      <Head big title="Sécurité" subtitle="Protégez l'accès à votre compte." onBack={onBack} />
      <Group title="Connexion">
        <PasswordForm api={api} />
        <PhoneForm api={api} phone={phone} onPhone={onPhone} />
      </Group>
      <Devices api={api} />
      <p className="bn-set-note"><LockKeyhole size={14} aria-hidden="true" /> Code PIN et empreinte : disponibles dans l'application mobile.</p>
    </>
  );
}

/** Langue : aperçu « Bonjour / Hello » puis toutes les langues (nom dans la langue et en anglais). */
function LanguagePage({ draft, set, onBack }) {
  const chosen = LANGUAGES.find((l) => l.code === draft.language) || LANGUAGES[0];
  return (
    <>
      <Head big title="Langue" subtitle="Choisissez la langue de l'application." onBack={onBack} />
      <div className="bn-set-hello notranslate" translate="no" aria-live="polite">
        <strong>{chosen.hello}</strong>
        <span>{chosen.name}</span>
      </div>
      <Group title="Toutes les langues">
        {LANGUAGES.map((l) => (
          <button key={l.code} type="button" className="bn-set-row bn-set-lang" onClick={() => set(['language'], l.code)} aria-pressed={draft.language === l.code}>
            <span className="bn-set-row__main notranslate" translate="no">
              <strong>{l.name}</strong>
              <small>{l.english}</small>
            </span>
            {draft.language === l.code && <Check size={20} className="bn-set-lang__check" aria-hidden="true" />}
          </button>
        ))}
      </Group>
      <p className="bn-set-note">Les traductions autres que le français et l'anglais peuvent être approximatives.</p>
    </>
  );
}

const REASONS = ["Je n'utilise plus BenneGo", "J'ai un autre compte", 'Problème avec une commande', 'Mes données personnelles', 'Autre raison'];

function DeletePage({ api, role, onBack, onDeleted }) {
  const [check, setCheck] = useState(null);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/account/deletion').then(({ data }) => setCheck(data)).catch(() => setCheck({ can_delete: false, blockers: [] })); }, []);
  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm('Supprimer votre compte BenneGo ? Vous pourrez le reprendre pendant 60 jours.')) return;
    setBusy(true);
    try {
      const { data } = await api.post('/account/deletion', { password, reason: reason || null });
      onDeleted?.(data);
    } catch { /* intercepteur */ } finally { setBusy(false); }
  };
  return (
    <>
      <Head big title="Supprimer mon compte" subtitle="Vous avez 60 jours pour changer d'avis." onBack={onBack} />
      <div className="bn-set-card">
        <h3>Ce qui se passe</h3>
        <ul>
          <li><b>Tout de suite</b> : votre compte est fermé, vous êtes déconnecté partout et ne recevez plus rien.</li>
          <li><b>Pendant 60 jours</b> : reconnectez-vous avec votre numéro et votre mot de passe pour reprendre votre compte.</li>
          <li><b>Après 60 jours</b> : le compte ne peut plus être repris et votre numéro est libéré.</li>
          <li><b>Après 6 mois</b> : vos données personnelles sont effacées. Les commandes passées restent pour la comptabilité, sans votre nom.</li>
        </ul>
      </div>
      {check === null ? <p className="bn-set-note">Vérification…</p> : check.can_delete ? (
        <form className="bn-set-form bn-set-form--card" onSubmit={submit}>
          {check.credit_balance > 0 && (
            <p className="bn-set-warn">Votre crédit de {Math.round(check.credit_balance).toLocaleString('fr-FR')} FCFA sera perdu
              {role === 'driver' ? ' : demandez son versement avant de supprimer votre compte.' : '.'}</p>
          )}
          <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Raison">
            <option value="">Pourquoi partez-vous ? (facultatif)</option>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="password" autoComplete="current-password" placeholder="Votre mot de passe pour confirmer" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="bn-set-btn bn-set-btn--danger" disabled={busy || !password}>{busy ? '…' : 'Supprimer mon compte'}</button>
        </form>
      ) : (
        <div className="bn-set-card bn-set-card--warn">
          <h3>Pas tout de suite</h3>
          <ul>{check.blockers.map((b) => <li key={b.message}>{b.message}</li>)}</ul>
        </div>
      )}
    </>
  );
}

/**
 * Réglages du compte (client, camionneur, admin) : notifications, confidentialité, sécurité et suppression.
 * Les interrupteurs ne s'appliquent qu'après « Valider » dans la barre du bas, comme dans la vidéo de référence.
 */
export default function SettingsView({ api, role, phone, onPhone, onBack, onDeleted }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [page, setPage] = useState('home');
  const [saving, setSaving] = useState(false);
  const setStore = useAccountSettings((s) => s.setSettings);

  useEffect(() => {
    api.get('/account/settings').then(({ data: d }) => {
      // La langue affichée est celle de cet appareil
      const settings = { ...d.settings, language: currentLanguage() };
      setData({ ...d, settings });
      setDraft(settings);
    }).catch(() => setData({ error: true }));
  }, []);

  const changes = useMemo(() => (data?.settings && draft ? diffOf(data.settings, draft) : []), [data, draft]);
  const set = (path, value) => setDraft((d) => setIn(d, path, value));
  const languageName = (code) => LANGUAGES.find((l) => l.code === code)?.name || 'Français';

  const save = async () => {
    setSaving(true);
    try {
      const { data: res } = await api.patch('/account/settings', patchOf(changes));
      setData((d) => ({ ...d, settings: res.settings }));
      setDraft(res.settings);
      setStore(res.settings);
      // Nouvelle langue : toute l'application est traduite tout de suite
      if (res.settings.language && res.settings.language !== currentLanguage()) await setLanguage(res.settings.language);
      toast.success('Réglages enregistrés');
    } catch { /* intercepteur */ } finally {
      setSaving(false);
    }
  };

  // Retour avec des modifications non validées : on prévient avant de les perdre
  const leave = () => {
    if (changes.length && !window.confirm('Quitter sans valider vos modifications ?')) return;
    onBack();
  };

  if (!data) return <main className="bn-set"><p className="bn-set-note">Chargement…</p></main>;
  if (data.error) return <main className="bn-set"><Head title="Réglages" onBack={onBack} /><p className="bn-set-note">Réglages indisponibles pour le moment.</p></main>;

  const n = draft.notifications;
  const onCount = data.categories.filter((c) => n[c] !== false).length;
  const back = () => setPage('home');

  return (
    <main className={`bn-set${changes.length ? ' has-bar' : ''}`}>
      {page === 'home' && (
        <>
          <Head big title="Réglages" subtitle="Comment BenneGo vous prévient et protège votre compte." onBack={leave} />
          <Group title="Préférences">
            <Row icon={Languages} title="Langue" onClick={() => setPage('language')}
              text={<span className="notranslate" translate="no">{languageName(draft.language)}</span>} />
          </Group>
          <Group title="Alertes">
            <Row icon={Bell} title="Notifications" onClick={() => setPage('notifications')}
              text={!n.push ? 'En pause' : [`${onCount}/${data.categories.length} types`, n.quiet_hours.enabled && `calme ${n.quiet_hours.start}–${n.quiet_hours.end}`].filter(Boolean).join(' · ')} />
          </Group>
          <Group title="Confidentialité & sécurité">
            {role !== 'admin' && (
              <Row icon={Eye} title="Confidentialité" onClick={() => setPage('privacy')}
                text={[draft.privacy.show_photo ? 'Photo visible' : 'Photo masquée', draft.privacy.hide_phone ? 'numéro masqué' : 'numéro pendant la course'].join(' · ')} />
            )}
            <Row icon={ShieldCheck} title="Sécurité" text="Mot de passe, numéro, appareils connectés" onClick={() => setPage('security')} />
          </Group>
          {role !== 'admin' && (
            <Group title="Compte">
              <Row icon={Trash2} danger title="Supprimer mon compte" text="Récupérable pendant 60 jours" onClick={() => setPage('delete')} />
            </Group>
          )}
        </>
      )}
      {page === 'notifications' && <NotificationsPage api={api} role={role} categories={data.categories} draft={draft} set={set} onBack={back} />}
      {page === 'language' && <LanguagePage draft={draft} set={set} onBack={back} />}
      {page === 'privacy' && <PrivacyPage role={role} draft={draft} set={set} onBack={back} />}
      {page === 'security' && <SecurityPage api={api} phone={phone} onPhone={onPhone} onBack={back} />}
      {page === 'delete' && <DeletePage api={api} role={role} onBack={back} onDeleted={onDeleted} />}

      {changes.length > 0 && (
        <div className="bn-set-bar" role="region" aria-label="Modifications non enregistrées">
          <span><i aria-hidden="true" /> {changes.length} modification{changes.length > 1 ? 's' : ''}</span>
          <button type="button" className="bn-set-bar__discard" onClick={() => setDraft(data.settings)} disabled={saving}>Annuler</button>
          <button type="button" className="bn-set-bar__save" onClick={save} disabled={saving}>{saving ? '…' : 'Valider'}</button>
        </div>
      )}
    </main>
  );
}
