import React from 'react';
import { motion } from 'motion/react';

// Décor animé de la vitrine : un camion-benne roule sur le chantier. Purement visuel, sans donnée.
export default function HeroTruck() {
  return (
    <svg className="landing-truck" viewBox="0 0 480 240" role="img" aria-label="Camion-benne qui roule vers le chantier">
      <defs>
        <linearGradient id="landing-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1e4" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect width="480" height="240" rx="28" fill="url(#landing-sky)" />
      <circle cx="390" cy="62" r="24" fill="#ffd9b8" />
      <rect x="0" y="176" width="480" height="20" rx="10" fill="#e7e0d6" />
      <motion.line
        x1="0"
        x2="480"
        y1="186"
        y2="186"
        stroke="#ffffff"
        strokeWidth="3"
        strokeDasharray="18 16"
        animate={{ strokeDashoffset: [0, -68] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      />
      <motion.g animate={{ x: [-170, 500] }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}>
        <rect x="0" y="92" width="122" height="62" rx="8" fill="#ff6b00" />
        <rect x="10" y="102" width="102" height="8" rx="4" fill="#ffb27a" />
        <path d="M122 112 H160 Q174 112 180 126 L190 152 V156 H122 Z" fill="#111827" />
        <rect x="136" y="118" width="26" height="16" rx="3" fill="#dbeafe" />
        <circle className="landing-wheel" cx="34" cy="158" r="14" fill="#111827" />
        <circle className="landing-wheel" cx="150" cy="158" r="14" fill="#111827" />
        <circle cx="34" cy="158" r="5" fill="#f2ebe2" />
        <circle cx="150" cy="158" r="5" fill="#f2ebe2" />
      </motion.g>
      <g aria-hidden="true">
        <path d="M410 150 C410 136 396 128 396 112 C396 102 404 96 412 96 C420 96 428 102 428 112 C428 128 414 136 410 150 Z" fill="#ff6b00" />
        <circle cx="412" cy="112" r="6" fill="#ffffff" />
      </g>
    </svg>
  );
}
