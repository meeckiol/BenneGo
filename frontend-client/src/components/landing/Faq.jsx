import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

// Questions fréquentes : une seule réponse ouverte à la fois, hauteur animée, navigable au clavier.
export default function Faq({ items }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <ul className="landing-faq">
      {items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `landing-faq-panel-${index}`;
        return (
          <li key={item.question} className="landing-faq__item">
            <button
              type="button"
              className="landing-faq__question"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenIndex(open ? null : index)}
            >
              <span>{item.question}</span>
              <span aria-hidden="true" className="landing-faq__icon">{open ? '−' : '+'}</span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  id={panelId}
                  role="region"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <p className="landing-faq__answer">{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
