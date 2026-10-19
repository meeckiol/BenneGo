import React, { useState } from 'react';

/** Notation de 1 à 5 étoiles (modifiable ou lecture seule) */
export default function StarRating({ value = 0, onChange, size = 36, label = 'Note' }) {
  const [hover, setHover] = useState(0);
  const readOnly = !onChange;
  const shown = hover || value;

  return (
    <div role={readOnly ? 'img' : 'radiogroup'} aria-label={`${label} : ${value} sur 5`}
      style={{ display: 'inline-flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          role={readOnly ? undefined : 'radio'}
          aria-checked={!readOnly ? value === n : undefined}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: 'none', border: 'none', padding: 0, lineHeight: 1,
            fontSize: size, cursor: readOnly ? 'default' : 'pointer',
            color: n <= shown ? '#FFB300' : '#D6D6D6',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
