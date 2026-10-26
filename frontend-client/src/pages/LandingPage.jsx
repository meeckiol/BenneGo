import React from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../components/landing/Reveal';
import RotatingWord from '../components/landing/RotatingWord';
import HeroTruck from '../components/landing/HeroTruck';
import Faq from '../components/landing/Faq';
import { WHATSAPP_URL } from '../constants/contact';
import '../styles/landing.css';

const MATERIALS = ['sable', 'gravier', 'latérite', 'briques'];

const STEPS = [
  { title: 'Décrivez votre besoin', text: 'Matériau, volume et adresse du chantier. Le devis s’affiche avant de commander.' },
  { title: 'Payez en sécurité', text: 'Votre paiement reste bloqué jusqu’à la livraison confirmée.' },
  { title: 'Suivez votre camion', text: 'La position du camion est visible sur la carte, de la prise en charge à la livraison.' },
];

const BENEFITS = [
  { title: 'Devis instantané', text: 'Prix du matériau et du transport calculés avant la validation.' },
  { title: 'Paiement sécurisé', text: 'Le séquestre protège le client comme le chauffeur.' },
  { title: 'Suivi en direct', text: 'Position du camion et étapes de la livraison, mises à jour pendant la mission.' },
  { title: 'Discussion directe', text: 'Échangez avec le chauffeur pendant la mission, dans l’application.' },
];

const TRUCKS = [
  { title: 'Benne 10 m³', text: 'Le camion-benne des chantiers courants.' },
  { title: 'Benne 16 m³', text: 'Plus de volume pour les grosses livraisons.' },
  { title: 'Semi-remorque benne 25 m³', text: 'Les gros volumes en un seul trajet.' },
  { title: 'Plateau et grue', text: 'Briques, fer et charges lourdes, avec grue embarquée si besoin.' },
  { title: 'Engins de chantier', text: 'Pelle, chargeuse, bulldozer, compacteur ou niveleuse, avec chauffeur.' },
];

const FAQ_ITEMS = [
  {
    question: 'Comment fonctionne le paiement ?',
    answer: 'Le montant est bloqué à la commande. Il n’est versé au chauffeur qu’une fois la livraison confirmée.',
  },
  {
    question: 'Comment suivre mon camion ?',
    answer: 'Depuis votre espace, la carte affiche la position du camion, mise à jour pendant la mission.',
  },
  {
    question: 'Puis-je commander par WhatsApp ?',
    answer: 'Oui. Écrivez-nous votre besoin, puis confirmez et payez dans l’application.',
  },
  {
    question: 'Comment créer mon compte ?',
    answer: 'Indiquez votre numéro de téléphone : un code de vérification vous est envoyé par SMS.',
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="BenneGo, accueil">
          <img src="/logo-icon.png" alt="" width="40" height="40" />
          <span>BenneGo</span>
        </Link>
        <nav className="landing-nav" aria-label="Navigation de la vitrine">
          <a href="#comment">Comment ça marche</a>
          <a href="#avantages">Avantages</a>
          <a href="#camions">Camions</a>
          <a href="#questions">Questions</a>
        </nav>
        <div className="landing-header__actions">
          <Link to="/login" className="bn-btn">Se connecter</Link>
          <Link to="/register" className="bn-btn bn-btn--primary">Créer un compte</Link>
        </div>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <Reveal className="landing-hero__text">
            <p className="bn-kicker">Transport de matériaux de chantier</p>
            <h1 id="landing-title" className="landing-title">
              Votre <span className="landing-accent"><RotatingWord words={MATERIALS} /></span>
              <span className="landing-title__line">livré sur le chantier</span>
            </h1>
            <p className="landing-lead">
              Commandez en quelques clics un camion-benne ou un engin avec chauffeur. Le devis s’affiche avant de
              commander, le paiement reste bloqué jusqu’à la livraison et vous suivez le camion sur la carte.
            </p>
            <div className="landing-cta">
              <Link to="/register" className="bn-btn bn-btn--primary">Obtenir un devis</Link>
              <Link to="/login" className="bn-btn">J’ai déjà un compte</Link>
            </div>
          </Reveal>
          <Reveal delay={0.15} className="landing-hero__visual">
            <HeroTruck />
          </Reveal>
        </section>

        <section id="comment" className="landing-section" aria-labelledby="comment-title">
          <Reveal>
            <h2 id="comment-title" className="landing-h2">Comment ça marche</h2>
          </Reveal>
          <ol className="landing-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="landing-step">
                <Reveal delay={index * 0.1}>
                  <span className="landing-step__number" aria-hidden="true">{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section id="avantages" className="landing-section" aria-labelledby="avantages-title">
          <Reveal>
            <h2 id="avantages-title" className="landing-h2">Pourquoi commander avec BenneGo</h2>
          </Reveal>
          <ul className="landing-grid">
            {BENEFITS.map((benefit, index) => (
              <li key={benefit.title} className="landing-card-wrap">
                <Reveal delay={index * 0.08} className="landing-card">
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section id="camions" className="landing-section" aria-labelledby="camions-title">
          <Reveal>
            <h2 id="camions-title" className="landing-h2">Le bon véhicule pour chaque chantier</h2>
          </Reveal>
          <ul className="landing-grid">
            {TRUCKS.map((truck, index) => (
              <li key={truck.title} className="landing-card-wrap">
                <Reveal delay={index * 0.06} className="landing-card">
                  <h3>{truck.title}</h3>
                  <p>{truck.text}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section id="questions" className="landing-section" aria-labelledby="questions-title">
          <Reveal>
            <h2 id="questions-title" className="landing-h2">Questions fréquentes</h2>
          </Reveal>
          <Reveal>
            <Faq items={FAQ_ITEMS} />
          </Reveal>
        </section>

        <section className="landing-band" aria-labelledby="band-title">
          <Reveal>
            <h2 id="band-title">Prêt à commander ?</h2>
            <p>Créez votre compte en une minute et obtenez votre devis.</p>
            <Link to="/register" className="bn-btn bn-btn--primary">Obtenir un devis</Link>
          </Reveal>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__brand">
          <img src="/logo-icon.png" alt="" width="32" height="32" />
          <span>BenneGo</span>
        </div>
        <nav className="landing-footer__links" aria-label="Liens utiles">
          <Link to="/login">Se connecter</Link>
          <Link to="/register">Créer un compte</Link>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Assistance WhatsApp</a>
        </nav>
        <p className="landing-footer__copy">© BenneGo. Matériaux et transport de chantier.</p>
      </footer>
    </div>
  );
}
