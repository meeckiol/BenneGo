import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, SendHorizontal } from 'lucide-react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import useAuthStore from '../store/authStore';
import { STATUS } from '../components/delivery';
import { CHAT_CLOSED, initialsOf } from './MessagesPage';
import '../styles/messages.css';

const hour = (d) => (d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');

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
  }, [id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const join = () => {
      socket.emit('chat_join', { order_id: id });
      socket.emit('track_order', id);
    };
    const onMessage = (msg) => { if (msg.order_id === id) setMessages((prev) => [...prev, msg]); };
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

  const send = (e) => {
    e.preventDefault();
    const message = text.trim();
    const socket = getSocket();
    if (!message || !socket) return;
    socket.emit('chat_message', { order_id: id, message });
    setText('');
  };

  const mine = (m) => m.sender_id === me?.id || m.sender_role === 'client';

  return (
    <main className="bn-chat">
      <header className="bn-chat__head">
        <button type="button" className="bn-chat__back" onClick={() => navigate('/messages')} aria-label="Retour aux messages">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        {order?.driver_phone ? (
          <a className="bn-chat__call" href={`tel:${order.driver_phone}`} aria-label={`Appeler ${order.driver_name || 'le chauffeur'}`}>
            <Phone size={18} aria-hidden="true" />
          </a>
        ) : (
          <span className="bn-chat__call is-off" aria-hidden="true"><Phone size={18} /></span>
        )}
        <span className="bn-thread__avatar" aria-hidden="true">{initialsOf(order?.driver_name)}</span>
        <span className="bn-chat__who">
          <strong>{order?.driver_name || 'Chauffeur'}</strong>
          <small>{order ? `${order.order_number} · ${STATUS[order.status]?.label || order.status}` : 'Chargement…'}</small>
        </span>
      </header>

      <div className="bn-chat__list" aria-live="polite">
        {messages.length === 0 && <p className="bn-chat__empty">Aucun message pour l'instant. Posez votre question au chauffeur.</p>}
        {messages.map((m, i) => (
          <div key={m.id || i} className={`bn-bubble${mine(m) ? ' is-me' : ''}`}>
            <p>{m.message}</p>
            <time>{hour(m.created_at)}</time>
          </div>
        ))}
        <span ref={end} />
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
    </main>
  );
}
