import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const INTERVAL_MS = 2600;

// Mot qui change en boucle dans le titre (« Votre sable livré… », « Votre gravier livré… »).
export default function RotatingWord({ words }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((current) => (current + 1) % words.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [words.length]);

  // Le mot le plus long réserve la largeur : aucun saut de mise en page, aucun espace vide.
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');

  return (
    <span className="landing-rotating">
      <span className="landing-rotating__sizer" aria-hidden="true">{longest}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={words[index]}
          className="landing-rotating__word"
          initial={{ opacity: 0, y: '0.6em' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '-0.6em' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
