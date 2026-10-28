import React from 'react';
import { Link } from 'react-router-dom';

/* Texte provisoire : les passages entre crochets restent à compléter, et le document doit être relu avant publication. */
const SECTIONS = [
  {
    title: 'Qui traite vos données',
    paragraphs: [
      'BenneGo est une plateforme de livraison de matériaux de chantier au Bénin. Le responsable du traitement est [raison sociale à compléter], [adresse à compléter].',
    ],
  },
  {
    title: 'Les données collectées',
    items: [
      'Votre identité : prénom, nom, date de naissance, adresse, numéro de téléphone et, si vous les renseignez, adresse e-mail et photo de profil.',
      'Vos commandes : lieux de chargement et de livraison, matériaux, historique, avis et paiements.',
      'Votre position, pendant que les chauffeurs sont disponibles ou en mission. Le client ne voit le camion que pendant sa course.',
      'Les photos envoyées pour le chargement, la livraison ou un litige.',
      'Les messages que vous envoyez à BenneGo par WhatsApp.',
    ],
  },
  {
    title: 'Pourquoi nous les utilisons',
    items: [
      'Créer votre compte et vérifier votre numéro par SMS.',
      'Organiser la livraison, suivre le camion et vous informer de son avancement.',
      'Encaisser le paiement, le garder bloqué jusqu’à votre confirmation, puis verser le chauffeur.',
      'Traiter les litiges, les pannes et les remboursements.',
      'Améliorer le service et prévenir les fraudes.',
    ],
  },
  {
    title: 'Paiements',
    paragraphs: [
      'Les paiements sont traités par KKiaPay. Les coordonnées de paiement, comme le numéro Mobile Money ou la carte, sont saisies chez ce prestataire.',
    ],
  },
  {
    title: 'Qui reçoit vos données',
    paragraphs: [
      'Le chauffeur qui assure votre course reçoit les informations nécessaires à la livraison. Nous faisons appel à des prestataires techniques (paiement, SMS, WhatsApp, hébergement). Nous ne vendons pas vos données.',
    ],
  },
  {
    title: 'Durées de conservation',
    paragraphs: [
      'Positions GPS et photos : [durée à compléter]. Comptes inactifs : [durée à compléter]. Les données de facturation sont conservées selon les obligations comptables.',
    ],
  },
  {
    title: 'Sécurité',
    paragraphs: [
      'Les mots de passe ne sont jamais conservés en clair. L’accès aux données est limité aux personnes qui en ont besoin pour le service.',
    ],
  },
  {
    title: 'Vos droits',
    paragraphs: [
      'Vous pouvez demander l’accès à vos données, leur correction ou leur suppression, et vous opposer à certains traitements. Écrivez à [adresse de contact à compléter]. La législation béninoise sur les données personnelles s’applique [référence à vérifier].',
    ],
  },
  {
    title: 'Modifications',
    paragraphs: [
      'Si cette politique change, nous vous en informerons dans l’application avant son entrée en vigueur.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="bn-page">
      <header className="bn-page-head">
        <div>
          <p className="bn-kicker">BenneGo</p>
          <h1 className="bn-title">Politique de confidentialité</h1>
        </div>
      </header>

      <p><span className="bn-pill bn-pill--warning">Version provisoire : à faire relire par un juriste avant publication</span></p>

      {SECTIONS.map((section) => (
        <section key={section.title} className="bn-card" style={{ display: 'grid', gap: 10 }}>
          <h2 className="bn-title" style={{ fontSize: 17 }}>{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="bn-subtitle">{paragraph}</p>
          ))}
          {section.items && (
            <ul className="bn-subtitle" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </section>
      ))}

      <p className="bn-subtitle"><Link to="/" className="bn-link">Retour à l'accueil</Link></p>
    </main>
  );
}
