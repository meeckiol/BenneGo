import React, { useEffect } from 'react';
import { create } from 'zustand';
import toast from 'react-hot-toast';
import { MessageCircle } from 'lucide-react';
import { alertPolicy, useAccountSettings } from './accountSettings';
import './messaging.css';

/*
 * Alertes de messagerie communes aux applications client et camionneur :
 * pastilles de messages non lus, bandeau « Nouveau message », son, vibration et notifications push.
 */

/** Messages non lus par commande, partagés entre la barre du bas, la liste et la discussion. */
export const useUnread = create((set) => ({
  byOrder: {},
  total: 0,
  load: (rows = []) => {
    const byOrder = Object.fromEntries(rows.map((r) => [r.order_id, r.unread]));
    set({ byOrder, total: rows.reduce((sum, r) => sum + r.unread, 0) });
  },
  bump: (orderId) => set((s) => ({ byOrder: { ...s.byOrder, [orderId]: (s.byOrder[orderId] || 0) + 1 }, total: s.total + 1 })),
  clear: (orderId) => set((s) => {
    const n = s.byOrder[orderId] || 0;
    if (!n) return s;
    const byOrder = { ...s.byOrder };
    delete byOrder[orderId];
    return { byOrder, total: Math.max(0, s.total - n) };
  }),
}));

/** Chiffre affiché sur une pastille : au-delà de 9, « 9+ ». */
export const badgeText = (n) => (n > 9 ? '9+' : String(n));

// Son court en deux notes, joué sans fichier audio. iOS exige un premier contact avant tout son.
let audio = null;
const unlockAudio = () => {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* pas de son sur ce navigateur */ }
};
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
}

export const playChime = ({ sound = true, vibrate = true } = {}) => {
  if (audio && sound) chime();
  try { if (vibrate) navigator.vibrate?.([120, 60, 120]); } catch { /* vibration indisponible */ }
};

const chime = () => {
  try {
    const now = audio.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.3);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.32);
    });
  } catch { /* son indisponible */ }
};

const initialsOf = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'BG';

function Banner({ t, msg, onOpen }) {
  return (
    <button
      type="button"
      className={`bn-msg-banner${t.visible ? ' is-in' : ''}`}
      onClick={() => { toast.dismiss(t.id); onOpen(); }}
    >
      <span className="bn-msg-banner__avatar" aria-hidden="true">{initialsOf(msg.sender_name)}</span>
      <span className="bn-msg-banner__main">
        <strong>{msg.sender_name || 'Nouveau message'}{msg.order_number ? <small> · {msg.order_number}</small> : null}</strong>
        <span>{msg.message}</span>
      </span>
      <MessageCircle size={18} aria-hidden="true" />
    </button>
  );
}

/**
 * Écoute les nouveaux messages pour toute l'application.
 * Dans la discussion concernée, rien ne s'affiche : la page marque elle-même le message comme lu.
 */
export function useChatAlerts({ api, getSocket, enabled, navigate }) {
  const load = useUnread((s) => s.load);
  const bump = useUnread((s) => s.bump);

  useEffect(() => {
    if (!enabled) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    const refresh = () => api.get('/orders/chat/unread').then(({ data }) => load(data.unread)).catch(() => {});
    useAccountSettings.getState().load(api);
    const onNotify = (msg) => {
      if (window.location.pathname === `/messages/${msg.order_id}` && document.visibilityState === 'visible') return;
      bump(msg.order_id);
      // Réglages : messages coupés = pastille seulement ; heures calmes ou son coupé = bandeau sans son
      const policy = alertPolicy('messages');
      if (!policy.show) return;
      playChime(policy);
      toast.custom((t) => <Banner t={t} msg={msg} onOpen={() => navigate(`/messages/${msg.order_id}`)} />, {
        id: `chat-${msg.order_id}`,
        duration: 5000,
        position: 'top-center',
      });
    };
    refresh();
    socket.on('connect', refresh);
    socket.on('chat_notify', onNotify);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      socket.off('connect', refresh);
      socket.off('chat_notify', onNotify);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  // Ouverture depuis une notification push : le service worker demande d'aller à la discussion
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event) => { if (event.data?.type === 'open' && event.data.url) navigate(event.data.url); };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);
}

/** Marque une discussion comme lue (serveur et pastilles). */
export const markChatRead = (api, orderId) => {
  useUnread.getState().clear(orderId);
  return api.post(`/orders/${orderId}/chat/read`).catch(() => {});
};

// ---- Notifications push ----

const toKey = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

/**
 * État des notifications sur cet appareil :
 * 'unsupported' (navigateur, ou iPhone sans l'app sur l'écran d'accueil), 'denied', 'off' ou 'on'.
 */
export async function pushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/** Demande l'autorisation puis abonne l'appareil. À appeler depuis un appui de l'utilisateur. */
export async function enablePush(api) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const { data } = await api.get('/push/public-key');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(data.public_key) });
  await api.post('/push/subscribe', sub.toJSON());
  return 'on';
}

export async function disablePush(api) {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return 'off';
  await api.delete('/push/subscribe', { data: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
  return 'off';
}
