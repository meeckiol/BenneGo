import React, { useEffect, useState } from 'react';
import api from '../services/api';

const stars = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—');

export default function ReviewsPage() {
  const [data, setData] = useState({ platform_reviews: [], driver_reviews: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/reviews').then(({ data: d }) => { setData(d); setLoading(false); });
  }, []);

  return (
    <div style={s.page}>
      <Section title={`⭐ Avis sur la plateforme (${data.platform_reviews.length})`}>
        {data.platform_reviews.map((r) => (
          <Row key={r.id} who={r.client_name} rating={r.rating} comment={r.comment} date={r.created_at} />
        ))}
        {!loading && data.platform_reviews.length === 0 && <Empty />}
      </Section>
      <Section title={`🚛 Avis sur les chauffeurs (${data.driver_reviews.length})`}>
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
      <strong style={{ color: 'white' }}>{who}</strong>
      <span style={{ color: '#FFB300', letterSpacing: 2 }}>{stars(rating)}</span>
    </div>
    {comment && <p style={s.comment}>{comment}</p>}
    <div style={s.meta}>{sub ? `${sub} · ` : ''}{new Date(date).toLocaleString('fr-FR')}</div>
  </div>
);

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 24 },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden' },
  cardHeader: { padding: '16px 20px', borderBottom: '1px solid #334155' },
  title: { color: 'white', fontSize: 15, fontWeight: 700, margin: 0 },
  row: { padding: '14px 20px', borderBottom: '1px solid #0f172a' },
  rowTop: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  comment: { color: '#cbd5e1', fontSize: 14, margin: '8px 0 4px' },
  meta: { color: '#64748b', fontSize: 12 },
  empty: { padding: 32, textAlign: 'center', color: '#475569' },
};
