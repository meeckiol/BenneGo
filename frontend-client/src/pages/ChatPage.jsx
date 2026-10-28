import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, SendHorizontal } from 'lucide-react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import useAuthStore from '../store/authStore';
import { STATUS, describe } from '../components/delivery';
import { CHAT_CLOSED, initialsOf } from './MessagesPage';
import { markChatRead } from '../../../shared/messaging';
import '../styles/messages.css';

const hour = (d) => (d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');

// Séparateur de jour entre les messages : « Aujourd'hui », « Hier » ou la date
const dayOf = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

// Réponses rapides proposées au-dessus du champ de saisie
const QUICK = ['Je suis sur place', 'Où êtes-vous ?', 'Appelez-moi', 'Merci !'];

/** Discussion avec le chauffeur d'une commande en cours. Elle se ferme quand la commande est terminée. */
export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const end = useRef(null);

  // Commande terminée : la discussion n'est plus affichée (les messages restent en base)
  const close = () => {
    toast('Commande terminée : la discussion est fermée.');
    navigate('/messages', { replace: true });
  };

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => {
        const o = data.order || data;
        if (CHAT_CLOSED.includes(o.status)) close();
        else setOrder(o);
      })
      .catch(() => navigate('/messages', { replace: true }));
    api.get(`/orders/${id}/chat`).then(({ data }) => setMessages(data.messages || [])).catch(() => {});
    markChatRead(api, id);
  }, [id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const join = () => {
      socket.emit('chat_join', { order_id: id });
      socket.emit('track_order', id);
    };
    const onMessage = (msg) => {
      if (msg.order_id !== id) return;
      setMessages((prev) => [...prev, msg]);
      // Message reçu pendant que la discussion est affichée : il est lu
      if (msg.sender_id !== me?.id && document.visibilityState === 'visible') markChatRead(api, id);
    };
    const onStatus = (data) => {
      if (data?.order_id && data.order_id !== id) return;
      const status = data?.status;
      if (CHAT_CLOSED.includes(status)) close();
      else if (status) setOrder((prev) => (prev ? { ...prev, status } : prev));
    };
    socket.on('connect', join);
    if (socket.connected) join();
    socket.on('chat_message', onMessage);
    socket.on('order_status', onStatus);
    return () => {
      socket.off('connect', join);
      socket.off('chat_message', onMessage);
      socket.off('order_status', onStatus);
    };
  }, [id]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const post = (raw) => {
    const message = raw.trim();
    const socket = getSocket();
    if (!message || !socket) return;
    socket.emit('chat_message', { order_id: id, message });
    setText('');
  };

  const send = (e) => {
    e.preventDefault();
    post(text);
  };

  const mine = (m) => m.sender_id === me?.id || m.sender_role === 'client';

  const status = order ? STATUS[order.status] : null;
  const progress = status ? Math.max(8, Math.round((status.stage / 3) * 100)) : 0;

  return (
    <main className="bn-chat">
      <header className="bn-chat__head">
        <div className="bn-chat__bar-top">
          <button type="button" className="bn-chat__back" onClick={() => navigate('/messages')} aria-label="Retour aux messages">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <span className="bn-chat__ring" aria-hidden="true">
            <span className="bn-thread__avatar">{initialsOf(order?.driver_name)}</span>
          </span>
          <span className="bn-chat__who">
            <strong>{order?.driver_name || 'Chauffeur'}</strong>
            <small>{order ? `${status?.label || order.status} · ${order.order_number}` : 'Chargement…'}</small>
          </span>
          {order?.driver_phone ? (
            <a className="bn-chat__call" href={`tel:${order.driver_phone}`} aria-label={`Appeler ${order.driver_name || 'le chauffeur'}`}>
              <Phone size={18} aria-hidden="true" />
            </a>
          ) : (
            <span className="bn-chat__call is-off" aria-hidden="true"><Phone size={18} /></span>
          )}
        </div>
        {order && (
          <div className="bn-chat__progress">
            <span className="bn-chat__progress-text">
              <span>{describe(order)}</span>
              <strong>{status?.tag || order.status}</strong>
            </span>
            <span className="bn-chat__track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement de la livraison">
              <span style={{ width: `${progress}%` }} />
            </span>
          </div>
        )}
      </header>

      <div className="bn-chat__list" aria-live="polite">
        {messages.length === 0 && <p className="bn-chat__empty">Aucun message pour l'instant. Posez votre question au chauffeur.</p>}
        {messages.map((m, i) => {
          const day = dayOf(m.created_at);
          const showDay = day && day !== dayOf(messages[i - 1]?.created_at);
          return (
            <React.Fragment key={m.id || i}>
              {showDay && <span className="bn-chat__day">{day}</span>}
              <div className={`bn-bubble${mine(m) ? ' is-me' : ''}${m.sender_role === 'admin' ? ' is-team' : ''}`}>
                {m.sender_role === 'admin' && <span className="bn-bubble__who">Assistance BenneGo</span>}
                <p>{m.message}</p>
                <time>{hour(m.created_at)}</time>
              </div>
            </React.Fragment>
          );
        })}
        <span ref={end} />
      </div>

      <footer className="bn-chat__foot">
        <div className="bn-chat__quick" aria-label="Réponses rapides">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => post(q)}>{q}</button>
          ))}
        </div>
        <form className="bn-chat__bar" onSubmit={send}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écrire un message…"
            aria-label="Message"
            maxLength={1000}
          />
          <button type="submit" disabled={!text.trim()} aria-label="Envoyer">
            <SendHorizontal size={20} aria-hidden="true" />
          </button>
        </form>
      </footer>
    </main>
  );
}
