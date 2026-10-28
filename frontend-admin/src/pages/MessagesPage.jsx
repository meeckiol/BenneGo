import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MessageCircle, Phone, Search, SendHorizontal } from 'lucide-react';
import api from '../services/api';

const STATUS_LABELS = {
  pending: 'Payée · en attente',
  accepted: 'Acceptée',
  driver_en_route_pickup: 'En route carrière',
  loading: 'Chargement',
  driver_en_route_delivery: 'En livraison',
  delivered: 'Livré',
  validated: 'Validé',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

const SCOPES = [
  { key: 'active', label: 'En cours' },
  { key: 'dispute', label: 'Litiges' },
  { key: 'all', label: 'Toutes' },
];

const WHO = {
  client: { label: 'Client', color: 'var(--info)' },
  driver: { label: 'Chauffeur', color: 'var(--brand-ink)' },
  admin: { label: 'Assistance BenneGo', color: 'var(--success)' },
};

const timeOf = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

/**
 * Messagerie client ↔ chauffeur, côté administration : lecture des discussions (y compris terminées,
 * utiles pour un litige) et message de l'assistance BenneGo, reçu par le client et le chauffeur.
 */
export default function MessagesPage() {
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState(params.get('scope') || 'active');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const selectedId = params.get('order');

  const loadList = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/conversations', { params: { scope, q: q.trim() || undefined } });
      setList(data.conversations || []);
    } catch {
      setList([]);
    }
  }, [scope, q]);

  // Liste rafraîchie toutes les 15 s : nouveaux messages et nouvelles courses
  useEffect(() => {
    const first = setTimeout(loadList, q ? 300 : 0);
    const timer = setInterval(loadList, 15000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [loadList]);

  const select = (id) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('order', id);
    return next;
  });

  const selected = useMemo(() => (list || []).find((c) => c.id === selectedId) || null, [list, selectedId]);

  return (
    <div style={s.page}>
      <h2 style={s.title}>Messagerie</h2>
      <p style={s.sub}>Discussions entre clients et chauffeurs. Votre message part au nom de l'Assistance BenneGo et prévient les deux.</p>

      <div style={s.layout}>
        <section style={s.listCol} aria-label="Discussions">
          <label style={s.search}>
            <Search size={16} aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° de commande, client, chauffeur"
              aria-label="Rechercher une discussion"
              style={s.searchInput}
            />
          </label>
          <div style={s.scopes} role="tablist" aria-label="Filtrer les discussions">
            {SCOPES.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={scope === f.key}
                onClick={() => setScope(f.key)}
                style={{ ...s.scope, ...(scope === f.key ? s.scopeOn : null) }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {list === null && <div style={s.muted}>Chargement…</div>}
          {list && list.length === 0 && <div style={s.empty}>Aucune discussion.</div>}
          <div style={s.threads}>
            {(list || []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.id)}
                style={{ ...s.thread, ...(c.id === selectedId ? s.threadOn : null) }}
              >
                <span style={s.threadTop}>
                  <strong style={s.orderNumber}>{c.order_number}</strong>
                  <small style={s.muted}>{timeOf(c.last_at)}</small>
                </span>
                <span style={s.threadWho}>{c.client_name || 'Client'} ↔ {c.driver_name || 'sans chauffeur'}</span>
                <span style={s.threadLast}>
                  {c.last_message ? `${WHO[c.last_sender_role]?.label || ''} : ${c.last_message}` : 'Aucun message'}
                </span>
                <span style={s.tags}>
                  <span style={s.tag}>{STATUS_LABELS[c.status] || c.status}</span>
                  {c.dispute_status === 'open' && <span style={{ ...s.tag, ...s.tagDanger }}>Litige</span>}
                  <span style={s.tag}>{c.message_count} message(s)</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section style={s.chatCol} aria-label="Discussion">
          {selectedId
            ? <Conversation key={selectedId} orderId={selectedId} info={selected} onSent={loadList} />
            : (
              <div style={s.placeholder}>
                <MessageCircle size={36} aria-hidden="true" />
                Choisissez une discussion à gauche.
              </div>
            )}
        </section>
      </div>
    </div>
  );
}

function Conversation({ orderId, info, onSent }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}/chat`);
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    }
  }, [orderId]);

  // Discussion ouverte : rafraîchie toutes les 5 s
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    setSending(true);
    try {
      await api.post(`/admin/orders/${orderId}/chat`, { message });
      setText('');
      toast.success('Message envoyé au client et au chauffeur');
      await load();
      onSent?.();
    } catch { /* intercepteur */ } finally {
      setSending(false);
    }
  };

  return (
    <div style={s.chat}>
      <header style={s.chatHead}>
        <div>
          <strong style={s.orderNumber}>{info?.order_number || 'Commande'}</strong>
          {info && <span style={{ ...s.muted, marginLeft: 8 }}>{STATUS_LABELS[info.status] || info.status}</span>}
        </div>
        {info && (
          <div style={s.contacts}>
            <a href={`tel:${info.client_phone}`} style={s.contact}><Phone size={14} aria-hidden="true" /> Client · {info.client_name} · {info.client_phone}</a>
            {info.driver_phone && (
              <a href={`tel:${info.driver_phone}`} style={s.contact}><Phone size={14} aria-hidden="true" /> Chauffeur · {info.driver_name} · {info.driver_phone}</a>
            )}
          </div>
        )}
      </header>

      <div style={s.messages} aria-live="polite">
        {messages === null && <div style={s.muted}>Chargement…</div>}
        {messages && messages.length === 0 && <div style={s.placeholder}>Aucun message dans cette discussion.</div>}
        {(messages || []).map((m) => {
          const who = WHO[m.sender_role] || { label: m.sender_name || m.sender_role, color: 'var(--text-3)' };
          const right = m.sender_role === 'admin';
          return (
            <div key={m.id} style={{ ...s.bubble, ...(right ? s.bubbleAdmin : m.sender_role === 'driver' ? s.bubbleDriver : null) }}>
              <span style={{ ...s.who, color: who.color }}>{who.label}{m.sender_role !== 'admin' && m.sender_name ? ` · ${m.sender_name}` : ''}</span>
              <p style={s.text}>{m.message}</p>
              <time style={s.time}>{timeOf(m.created_at)}</time>
            </div>
          );
        })}
        <span ref={end} />
      </div>

      <form onSubmit={send} style={s.bar}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire en tant qu'Assistance BenneGo…"
          aria-label="Message de l'assistance"
          maxLength={1000}
          style={s.barInput}
        />
        <button type="submit" disabled={sending || !text.trim()} style={s.sendBtn} aria-label="Envoyer">
          <SendHorizontal size={18} aria-hidden="true" /> Envoyer
        </button>
      </form>
    </div>
  );
}

const s = {
  page: { padding: 24, color: 'var(--text)' },
  title: { margin: '0 0 6px', fontSize: 22, fontWeight: 800 },
  sub: { margin: '0 0 20px', color: 'var(--text-3)', fontSize: 14 },
  muted: { color: 'var(--text-3)', fontSize: 12 },
  empty: { background: 'var(--surface)', borderRadius: 12, padding: 20, color: 'var(--text-3)', textAlign: 'center', fontSize: 14 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: 16, alignItems: 'start' },
  listCol: { display: 'grid', gap: 10 },
  search: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, borderRadius: 10, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)' },
  searchInput: { flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--text)', fontSize: 14 },
  scopes: { display: 'flex', gap: 6 },
  scope: { padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  scopeOn: { background: '#0b0b10', borderColor: '#0b0b10', color: '#ffffff' },
  threads: { display: 'grid', gap: 8, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' },
  thread: { display: 'grid', gap: 4, padding: 12, borderRadius: 12, border: '1px solid var(--border-2)', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' },
  threadOn: { borderColor: '#D9A55B', boxShadow: '0 0 0 2px rgba(217, 165, 91, 0.35)' },
  threadTop: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  orderNumber: { color: 'var(--brand-ink)', fontSize: 14 },
  threadWho: { fontSize: 13, fontWeight: 600 },
  threadLast: { fontSize: 13, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tags: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tag: { padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', fontSize: 11, fontWeight: 700, color: 'var(--text-2)' },
  tagDanger: { background: 'var(--danger-soft)', color: 'var(--danger)' },
  chatCol: { minWidth: 0 },
  placeholder: { display: 'grid', justifyItems: 'center', gap: 10, padding: 40, borderRadius: 12, background: 'var(--surface)', color: 'var(--text-3)', fontSize: 14 },
  chat: { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', height: 'calc(100vh - 250px)', minHeight: 420, borderRadius: 12, border: '1px solid var(--border-2)', background: 'var(--surface)', overflow: 'hidden' },
  chatHead: { display: 'grid', gap: 6, padding: '12px 16px', borderBottom: '1px solid var(--border-2)' },
  contacts: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  contact: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', textDecoration: 'none' },
  messages: { display: 'flex', flexDirection: 'column', gap: 8, padding: 16, overflowY: 'auto', background: 'var(--bg)' },
  bubble: { alignSelf: 'flex-start', maxWidth: '70%', padding: '8px 12px', borderRadius: '14px 14px 14px 4px', background: 'var(--surface)', border: '1px solid var(--border-2)' },
  bubbleDriver: { background: 'rgba(217, 165, 91, 0.14)', borderColor: 'rgba(217, 165, 91, 0.4)' },
  bubbleAdmin: { alignSelf: 'flex-end', borderRadius: '14px 14px 4px 14px', background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.35)' },
  who: { display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 2 },
  text: { margin: 0, fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  time: { display: 'block', marginTop: 4, fontSize: 11, color: 'var(--text-3)', textAlign: 'right' },
  bar: { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border-2)' },
  barInput: { flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 },
  sendBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 10, border: 'none', background: '#D9A55B', color: '#0b0b10', fontWeight: 700, cursor: 'pointer' },
};
