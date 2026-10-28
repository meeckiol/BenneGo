import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { hasGoogleMaps, loadGoogleMaps, resolvePlace, suggestPlaces } from '../../../shared/googleMaps';
import '../styles/gmap.css';

/**
 * Champ « Où livrer ? » : avec Google, des suggestions de lieux au Bénin s'affichent pendant la saisie
 * et le choix place le repère. Sans clé Google, c'est un simple champ texte.
 */
export default function AddressSearch({ name, value, onChange, onPick, placeholder, label, near }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const session = useRef(null);
  const typed = useRef(false);

  useEffect(() => {
    if (!hasGoogleMaps() || !typed.current) return undefined;
    const q = (value || '').trim();
    if (q.length < 3) {
      setItems([]);
      return undefined;
    }
    let alive = true;
    // Petite pause après la frappe : une requête par mot plutôt qu'une par lettre
    const timer = setTimeout(async () => {
      try {
        const maps = await loadGoogleMaps();
        const { AutocompleteSessionToken } = await maps.importLibrary('places');
        session.current = session.current || new AutocompleteSessionToken();
        const found = await suggestPlaces(maps, q, { sessionToken: session.current, near });
        if (alive) {
          setItems(found.slice(0, 5));
          setOpen(true);
        }
      } catch {
        if (alive) setItems([]);
      }
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [value]);

  const pick = async (item) => {
    setOpen(false);
    setItems([]);
    typed.current = false;
    try {
      const place = await resolvePlace(item);
      session.current = null;
      onPick?.(place);
    } catch { /* lieu introuvable : le texte saisi reste */ }
  };

  return (
    <label className="bn-order__search">
      <Search size={18} aria-hidden="true" />
      <input
        name={name}
        value={value}
        onChange={(e) => { typed.current = true; onChange(e); }}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={`${name}-suggestions`}
      />
      {open && items.length > 0 && (
        <ul className="bn-suggest" id={`${name}-suggestions`} role="listbox">
          {items.map((item) => (
            <li key={item.id} role="option" aria-selected="false">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(item)}>
                <MapPin size={18} aria-hidden="true" />
                <span><strong>{item.main}</strong>{item.secondary && <small>{item.secondary}</small>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
