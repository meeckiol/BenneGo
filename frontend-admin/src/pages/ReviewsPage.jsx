import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Star } from 'lucide-react';
import { dateLocale } from '../../../shared/i18n/dom';

const stars = (n) => (n ? Array.from({ length: 5 }, (_, i) => (
  <Star key={i} size={14} fill={i < n ? 'currentColor' : 'none'} aria-hidden="true" />
)) : '—');

export default function ReviewsPage() {
  const [data, setData] = useState({ platform_reviews: [], driver_reviews: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/reviews').then(({ data: d }) => { setData(d); setLoading(false); });
  }, []);

  return (
    <div style={s.page}>
      <Section title={`Avis sur la plateforme (${data.platform_reviews.length})`}>
        {data.platform_reviews.map((r) => (
          <Row key={r.id} who={r.client_name} rating={r.rating} comment={r.comment} date={r.created_at} />
        ))}
        {!loading && data.platform_reviews.length === 0 && <Empty />}
      </Section>
      <Section title={`Avis sur les chauffeurs (${data.driver_reviews.length})`}>
        {data.driver_reviews.map((r) => (
          <Row key={r.order_id} who={`${r.client_name} → ${r.driver_name}`} rating={r.rating} comment={r.comment} date={r.rated_at} sub={r.order_number} />
        ))}
        {!loading && data.driver_reviews.length === 0 && <Empty />}
      </Section>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div style={s.card}>
    <div style={s.cardHeader}><h3 style={s.title}>{title}</h3></div>
    <div>{children}</div>
  </div>
);
const Empty = () => <div style={s.empty}>Aucun avis pour l'instant</div>;
const Row = ({ who, rating, comment, date, sub }) => (
  <div style={s.row}>
    <div style={s.rowTop}>
      <strong style={{ color: 'var(--text-strong)' }}>{who}</strong>
      <span style={{ color: 'var(--warning)', display: 'flex', gap: 2 }}>{stars(rating)}</span>
    </div>
    {comment && <p style={s.comment}>{comment}</p>}
    <div style={s.meta}>{sub ? `${sub} · ` : ''}{new Date(date).toLocaleString(dateLocale())}</div>
  </div>
);

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 24 },
  card: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' },
  cardHeader: { padding: '16px 20px', borderBottom: '1px solid var(--border-2)' },
  title: { color: 'var(--text-strong)', fontSize: 15, fontWeight: 700, margin: 0 },
  row: { padding: '14px 20px', borderBottom: '1px solid var(--border)' },
  rowTop: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  comment: { color: 'var(--text-2)', fontSize: 14, margin: '8px 0 4px' },
  meta: { color: 'var(--text-2)', fontSize: 12 },
  empty: { padding: 32, textAlign: 'center', color: 'var(--text-2)' },
};
