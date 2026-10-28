import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, BellOff } from 'lucide-react';
import { pushState, enablePush, disablePush } from './messaging';

const TEXT = {
  on: 'Activées sur cet appareil',
  off: 'Être prévenu des messages, app fermée',
  denied: 'Bloquées : autorisez-les dans les réglages du téléphone',
  unsupported: "Sur iPhone : ajoutez d'abord l'app à l'écran d'accueil",
  loading: '…',
};

/** Ligne du profil (style des lignes à icône de couleur) qui active ou coupe les notifications push. */
export default function PushToggle({ api }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => { pushState().then(setState); }, []);

  const toggle = async () => {
    if (busy || state === 'unsupported' || state === 'loading') return;
    if (state === 'denied') {
      toast("Les notifications sont bloquées pour BenneGo dans les réglages du téléphone.");
      return;
    }
    setBusy(true);
    try {
      const next = state === 'on' ? await disablePush(api) : await enablePush(api);
      setState(next);
      if (next === 'on') toast.success('Notifications activées');
    } catch {
      toast.error("Impossible d'activer les notifications sur cet appareil");
    } finally {
      setBusy(false);
    }
  };

  const on = state === 'on';
  const Icon = on ? Bell : BellOff;
  return (
    <button type="button" className="bn-prow" onClick={toggle} disabled={busy} aria-pressed={on}>
      <span className={`bn-prow__icon bn-prow__icon--${on ? 'green' : 'sand'}`}><Icon size={20} aria-hidden="true" /></span>
      <span className="bn-prow__main">
        <strong>Notifications</strong>
        <small>{busy ? '…' : TEXT[state]}</small>
      </span>
      <span className={`bn-switch${on ? ' is-on' : ''}`} aria-hidden="true"><span /></span>
    </button>
  );
}
