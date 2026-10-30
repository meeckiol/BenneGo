import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { dateLocale } from '../../../shared/i18n/dom';

/*
 * Prix du marché : matériaux sous leurs noms d'ici et prix d'un voyage selon le camion (6, 10 ou 12 roues),
 * publiés chaque semaine par BenneGo. Affichés sur l'accueil et pendant la commande.
 */

const NUM = new Intl.NumberFormat('fr-FR');
const fcfa = (v) => `${NUM.format(Math.round(Number(v) || 0))} FCFA`;
const shortDate = (isoDay) => new Date(`${isoDay}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
export const marketPeriod = (item) => `du ${shortDate(item.week_start)} au ${shortDate(item.week_end)}`;
const TREND = { up: ['↑', 'bn-market__trend--up', 'En hausse'], down: ['↓', 'bn-market__trend--down', 'En baisse'], stable: ['→', '', 'Stable'] };

// Chargé une seule fois par visite : le catalogue ne change pas, les prix une fois par semaine
let cache = null;
const loadMarket = () => {
  cache ??= Promise.all([api.get('/barometer/catalog'), api.get('/barometer')])
    // Réponses incomplètes (serveur ancien, panne) : listes vides plutôt qu'un écran cassé
    .then(([{ data: catalog }, { data }]) => ({
      catalog: { materials: catalog?.materials || [], trucks: catalog?.trucks || [] },
      items: data?.items || [],
    }))
    .catch(() => { cache = null; return { catalog: { materials: [], trucks: [] }, items: [] }; });
  return cache;
};

export function useMarket() {
  const [market, setMarket] = useState({ catalog: { materials: [], trucks: [] }, items: [], ready: false });
  useEffect(() => {
    let alive = true;
    loadMarket().then((m) => alive && setMarket({ ...m, ready: true }));
    return () => { alive = false; };
  }, []);
  return market;
}

function Trend({ trend }) {
  const [arrow, className, label] = TREND[trend] || TREND.stable;
  return <span className={`bn-market__trend ${className}`} aria-label={label} title={label}>{arrow}</span>;
}

/** Accueil : prix du voyage en camion 10 roues de chaque matériau (le camion le plus courant). */
export function MarketPricesCard() {
  const { items, ready } = useMarket();
  if (!ready || !items.length) return null;
  const rows = items.filter((i) => i.truck_size === '10_roues');
  const shown = rows.length ? rows : items;
  return (
    <section className="bn-market" aria-label="Prix du marché">
      <div className="bn-deliveries__head">
        <h2>Prix du marché</h2>
        <span className="bn-market__when">{marketPeriod(shown[0])}</span>
      </div>
      <p className="bn-market__sub">{rows.length ? 'Prix d\'un voyage en camion 10 roues, relevés par BenneGo' : 'Prix d\'un voyage, relevés par BenneGo'}</p>
      <ul className="bn-market__list">
        {shown.slice(0, 8).map((i) => (
          <li key={i.id}>
            <Link to={`/orders/new?type=MATERIAL&matiere=${encodeURIComponent(i.material_name)}`} className="bn-market__row">
              <span className="bn-market__name">{i.material_name}{!rows.length && <small>{i.truck_name}</small>}</span>
              <span className="bn-market__price">{fcfa(i.price_avg)}</span>
              <Trend trend={i.trend} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Commande : prix du marché du matériau choisi, pour le camion qui correspond à la benne demandée. */
export function MarketPriceHint({ materialName, truckType }) {
  const { catalog, items } = useMarket();
  const material = catalog.materials.find((m) => m.name === materialName);
  if (!material || !material.voyage) return null;
  const rows = items.filter((i) => i.material_key === material.key);
  if (!rows.length) return null;
  const truck = catalog.trucks.find((tr) => tr.truck_types.includes(truckType));
  const best = rows.find((i) => i.truck_size === truck?.key);
  return (
    <div className="bn-market-hint" role="note">
      <strong>Prix du marché {best ? marketPeriod(best) : marketPeriod(rows[0])}</strong>
      {(best ? [best] : rows).map((i) => (
        <span key={i.id}>
          {`${i.truck_name} : ${fcfa(i.price_avg)} le voyage`}
          <small>{`entre ${fcfa(i.price_min)} et ${fcfa(i.price_max)}`}</small>
          {' '}<Trend trend={i.trend} />
        </span>
      ))}
    </div>
  );
}

const OTHER = '__autre';

/**
 * Commande : menu déroulant des matériaux sous leurs noms d'ici, avec « Autre » pour écrire librement.
 * La valeur reste le texte du matériau (material_description) ; « Sable » venu de l'accueil choisit « Sable lagunaire ».
 */
export function MaterialPicker({ name, value, onChange, style }) {
  const { catalog, ready } = useMarket();
  const [other, setOther] = useState(false);
  const materials = catalog.materials;
  const exact = materials.find((m) => m.name === value);
  const guess = !exact && value && materials.find((m) => m.name.toLowerCase().startsWith(value.toLowerCase()));
  const emit = (v) => onChange({ target: { name, value: v } });

  // Un nom approximatif (lien ancien, tuile de l'accueil) prend le matériau correspondant ; inconnu : « Autre »
  useEffect(() => {
    if (!ready || exact || !value) return;
    if (guess) emit(guess.name);
    else setOther(true);
  }, [ready, value]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (e) => {
    if (e.target.value === OTHER) { setOther(true); emit(''); return; }
    setOther(false);
    emit(e.target.value);
  };

  if (ready && !materials.length) {
    // Catalogue injoignable : saisie libre
    return <input name={name} value={value} onChange={onChange} placeholder="Ex : sable lagunaire, gravier 15/25, latérite…" style={style} required />;
  }
  return (
    <>
      <select aria-label="Matériau commandé" value={other ? OTHER : exact?.name || ''} onChange={choose} style={style} required={!other}>
        <option value="">Choisir le matériau</option>
        {materials.map((m) => <option key={m.key} value={m.name}>{m.name}</option>)}
        <option value={OTHER}>Autre (préciser)</option>
      </select>
      {other && (
        <input
          name={name}
          aria-label="Préciser le matériau"
          value={value}
          onChange={onChange}
          placeholder="Écrivez le matériau voulu"
          style={{ ...style, marginTop: 8 }}
          required
          autoFocus
        />
      )}
    </>
  );
}
