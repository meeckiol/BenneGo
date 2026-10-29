import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, MapPin, ShieldCheck } from 'lucide-react';
import '../styles/auth.css';

// Le carrousel ne s'affiche qu'au premier lancement ; ensuite l'application ouvre directement la connexion
export const ONBOARDING_KEY = 'bennego-bienvenue-vue';

export function hasSeenOnboarding() {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

const SLIDES = [
  {
    icon: Layers,
    title: 'Vos matériaux en quelques touches',
    text: 'Sable, gravier, latérite, engins avec chauffeur : choisissez la quantité, le devis s\'affiche avant de commander.',
    chips: ['Sable', 'Gravier', 'Latérite'],
  },
  {
    icon: MapPin,
    title: 'Suivez le camion en direct',
    text: 'Le chauffeur apparaît sur la carte jusqu\'à votre chantier. Vous savez quand il arrive.',
    chips: ['En route', 'Arrivée 12 min'],
  },
  {
    icon: ShieldCheck,
    title: 'Payez en toute sécurité',
    text: 'Votre paiement reste bloqué jusqu\'à la livraison confirmée. Pas de livraison, pas de paiement.',
    chips: ['Paiement bloqué', 'Libéré à la livraison'],
  },
];

const CHIP_SPOTS = [
  { top: -14, left: -36 },
  { bottom: 6, right: -44 },
  { bottom: -16, left: -10 },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = () => {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // Stockage indisponible : le carrousel reviendra au prochain lancement
    }
    navigate('/login', { replace: true });
  };

  const goTo = (i) => {
    const el = track.current;
    el?.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <main className="bn-onboard">
      <div className="bn-onboard__top">
        <span className="bn-login__brand">
          <img src="/logo-icon.png" alt="" width="32" height="32" />
          <span translate="no">Benne<em>Go</em></span>
        </span>
        <button type="button" className="bn-onboard__skip" onClick={finish}>
          Passer
        </button>
      </div>

      <div ref={track} className="bn-onboard__track" onScroll={onScroll} aria-roledescription="carrousel">
        {SLIDES.map((slide, i) => (
          <section
            key={slide.title}
            className="bn-onboard__slide"
            aria-roledescription="diapositive"
            aria-label={`${i + 1} sur ${SLIDES.length}`}
            aria-hidden={i !== index}
          >
            <div className="bn-onboard__art">
              <slide.icon size={88} strokeWidth={1.6} aria-hidden="true" />
              {slide.chips.map((chip, k) => (
                <span key={chip} className="bn-onboard__chip" style={CHIP_SPOTS[k]}>{chip}</span>
              ))}
            </div>
            <h1 className="bn-onboard__title">{slide.title}</h1>
            <p className="bn-onboard__text">{slide.text}</p>
          </section>
        ))}
      </div>

      <div className="bn-onboard__bottom">
        <div className="bn-onboard__dots">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              className={`bn-onboard__dot${i === index ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Aller à l'écran ${i + 1}`}
              aria-current={i === index ? 'step' : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          className="bn-btn bn-btn--primary bn-btn--block bn-login__submit"
          onClick={() => (last ? finish() : goTo(index + 1))}
        >
          {last ? 'Commencer' : 'Suivant'}
        </button>
      </div>
    </main>
  );
}
