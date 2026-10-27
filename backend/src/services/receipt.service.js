/**
 * receipt.service.js
 * Génération des reçus PDF pour les commandes BenneGo.
 *
 * Deux types de reçu :
 *  - client  : informations de la commande, client, conducteur, montant payé
 *  - driver  : idem + part du conducteur après déduction de la commission
 */

const PDFDocument = require('pdfkit');

// ─── Couleurs et polices ────────────────────────────────────────────────────
const ORANGE  = '#FF6B00';
const DARK    = '#1a1a2e';
const GREY    = '#64748b';
const WHITE   = '#ffffff';
const GREEN   = '#10B981';
const RED     = '#EF4444';

/**
 * Formate un montant en FCFA
 */
const fcfa = (amount) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(amount) || 0)) + ' FCFA';

/**
 * Formate une date lisible
 */
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/**
 * Formate une date de naissance
 */
const fmtBirth = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
};

/**
 * Dessine l'en-tête commun à tous les reçus
 */
const drawHeader = (doc, type) => {
  // Fond orange en haut
  doc.rect(0, 0, doc.page.width, 90).fill(ORANGE);

  // Titre
  doc.fillColor(WHITE)
     .fontSize(22)
     .font('Helvetica-Bold')
     .text('BenneGo', 50, 22);

  doc.fontSize(11)
     .font('Helvetica')
     .text('Plateforme de livraison de matériaux de chantier — Bénin', 50, 50);

  // Badge type de reçu
  const label = type === 'driver' ? 'REÇU CONDUCTEUR' : 'REÇU CLIENT';
  doc.rect(doc.page.width - 180, 20, 130, 30).fill('rgba(0,0,0,0.2)');
  doc.fillColor(WHITE)
     .fontSize(11)
     .font('Helvetica-Bold')
     .text(label, doc.page.width - 175, 28, { width: 120, align: 'center' });

  doc.fillColor(DARK);
};

/**
 * Dessine une section avec un titre
 */
const drawSection = (doc, title, y) => {
  doc.rect(50, y, doc.page.width - 100, 24).fill('#f1f5f9');
  doc.fillColor(ORANGE)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text(title.toUpperCase(), 58, y + 7);
  doc.fillColor(DARK);
  return y + 32;
};

/**
 * Dessine une ligne clé/valeur
 */
const drawRow = (doc, label, value, y, valueColor = DARK) => {
  doc.fillColor(GREY)
     .fontSize(10)
     .font('Helvetica')
     .text(label, 58, y, { width: 180 });

  doc.fillColor(valueColor)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text(String(value || '—'), 250, y, { width: doc.page.width - 300 });

  return y + 20;
};

/**
 * Dessine le pied de page
 */
const drawFooter = (doc) => {
  const y = doc.page.height - 60;
  doc.rect(0, y, doc.page.width, 60).fill('#f8fafc');
  doc.rect(0, y, doc.page.width, 2).fill(ORANGE);

  doc.fillColor(GREY)
     .fontSize(9)
     .font('Helvetica')
     .text(
       'Ce document est généré automatiquement par la plateforme BenneGo. ' +
       'Conservez-le comme preuve de paiement.',
       50, y + 12, { width: doc.page.width - 100, align: 'center' }
     );

  doc.text(
    `Généré le ${fmtDate(new Date())}`,
    50, y + 30, { width: doc.page.width - 100, align: 'center' }
  );
};

/**
 * Génère le PDF d'un reçu et le pipe dans la réponse Express.
 *
 * @param {Object} res      - réponse Express
 * @param {Object} order    - données de la commande (avec infos client/conducteur jointures)
 * @param {'client'|'driver'} type
 */
const generateReceiptPDF = (res, order, type = 'client') => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 100, bottom: 70, left: 50, right: 50 },
    info: {
      Title: `Reçu ${order.order_number}`,
      Author: 'BenneGo',
      Subject: type === 'driver' ? 'Reçu conducteur' : 'Reçu client',
    },
  });

  // Headers HTTP pour déclencher le téléchargement
  const filename = `recu-${type}-${order.order_number}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // ── En-tête ──────────────────────────────────────────────────────────────
  drawHeader(doc, type);

  let y = 105;

  // ── Numéro de commande ───────────────────────────────────────────────────
  doc.fillColor(DARK)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text(`Commande  ${order.order_number}`, 50, y, { align: 'center', width: doc.page.width - 100 });

  y += 22;

  // Statut
  const statusLabel = {
    completed: 'COMPLÉTÉE', validated: 'VALIDÉE', delivered: 'LIVRÉE',
    cancelled: 'ANNULÉE', pending: 'EN COURS',
  }[order.status] || order.status?.toUpperCase();
  const statusColor = ['completed','validated','delivered'].includes(order.status) ? GREEN : RED;

  doc.fillColor(statusColor)
     .fontSize(11)
     .font('Helvetica-Bold')
     .text(`Statut : ${statusLabel}`, 50, y, { align: 'center', width: doc.page.width - 100 });

  y += 30;

  // ── Section commande ─────────────────────────────────────────────────────
  y = drawSection(doc, 'Détails de la commande', y);
  y = drawRow(doc, 'Numéro de commande', order.order_number, y, ORANGE);
  y = drawRow(doc, 'Date de commande', fmtDate(order.created_at), y);
  y = drawRow(doc, 'Date de livraison', fmtDate(order.delivered_at), y);
  y = drawRow(doc, 'Matériau', order.material_name || order.material_description || '—', y);
  y = drawRow(doc, 'Quantité', order.quantity_m3 ? `${order.quantity_m3} m³` : '—', y);
  y = drawRow(doc, 'Distance', order.distance_km ? `${order.distance_km} km` : '—', y);
  y = drawRow(doc, 'Chargement', order.pickup_address, y);
  y = drawRow(doc, 'Livraison', order.delivery_address, y);
  y += 10;

  // ── Section client ───────────────────────────────────────────────────────
  y = drawSection(doc, 'Informations client', y);
  y = drawRow(doc, 'Nom complet', order.client_full_name || order.client_name, y);
  y = drawRow(doc, 'Prénom', order.client_prenom, y);
  y = drawRow(doc, 'Nom de famille', order.client_nom, y);
  y = drawRow(doc, 'Téléphone', order.client_phone, y);
  y = drawRow(doc, 'Date de naissance', fmtBirth(order.client_date_naissance), y);
  y = drawRow(doc, 'Adresse', order.client_adresse, y);
  y += 10;

  // ── Section conducteur ───────────────────────────────────────────────────
  y = drawSection(doc, 'Informations conducteur', y);
  y = drawRow(doc, 'Nom complet', order.driver_full_name || order.driver_name, y);
  y = drawRow(doc, 'Téléphone', order.driver_phone, y);
  if (order.driver_date_naissance) {
    y = drawRow(doc, 'Date de naissance', fmtBirth(order.driver_date_naissance), y);
  }
  if (order.driver_adresse) {
    y = drawRow(doc, 'Adresse', order.driver_adresse, y);
  }
  y = drawRow(doc, 'Type de camion',
    order.truck_type === 'double_benne' ? 'Double benne'
    : order.truck_type === 'simple_benne' ? 'Benne simple'
    : order.truck_type === 'plateau' ? 'Plateau'
    : order.truck_type === 'pickup' ? 'Pick-up léger' : '—', y);
  y = drawRow(doc, 'Plaque d\'immatriculation', order.truck_plate, y);
  y += 10;

  // ── Section paiement ─────────────────────────────────────────────────────
  y = drawSection(doc, 'Paiement', y);

  // Cadre montant total
  doc.rect(50, y, doc.page.width - 100, 36).fill('#fff7ed').stroke(ORANGE);
  doc.fillColor(GREY).fontSize(10).font('Helvetica').text('Montant total payé', 62, y + 8);
  doc.fillColor(ORANGE).fontSize(16).font('Helvetica-Bold')
     .text(fcfa(order.total_amount), 250, y + 6, { width: doc.page.width - 310 });
  y += 46;

  y = drawRow(doc, 'Mode de paiement',
    order.payment_method === 'mtn_momo' ? 'MTN Mobile Money'
    : order.payment_method === 'moov_money' ? 'Moov Money'
    : order.payment_method || '—', y);
  y = drawRow(doc, 'Référence paiement', order.payment_reference || '—', y);
  y = drawRow(doc, 'Date de paiement', fmtDate(order.payment_at), y);

  // ── Section répartition (conducteur seulement) ──────────────────────────
  if (type === 'driver') {
    y += 10;
    y = drawSection(doc, 'Répartition des gains (conducteur)', y);

    const commRate = order.total_amount > 0
      ? ((order.commission_amount / order.total_amount) * 100).toFixed(1)
      : '10.0';
    const driverRate = (100 - parseFloat(commRate)).toFixed(1);

    // Barre visuelle de répartition
    const barWidth = doc.page.width - 100;
    const driverBarW = Math.round((parseFloat(driverRate) / 100) * barWidth);
    doc.rect(50, y, driverBarW, 18).fill(GREEN);
    doc.rect(50 + driverBarW, y, barWidth - driverBarW, 18).fill(RED);

    doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold')
       .text(`${driverRate}% Conducteur`, 54, y + 4, { width: driverBarW - 4 });
    doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold')
       .text(`${commRate}% Plateforme`, 50 + driverBarW + 2, y + 4, { width: barWidth - driverBarW - 4, align: 'right' });
    y += 28;

    y = drawRow(doc, 'Montant brut de la course', fcfa(order.total_amount), y);

    // Commission
    doc.fillColor(GREY).fontSize(10).font('Helvetica')
       .text(`Commission plateforme (${commRate}%)`, 58, y, { width: 180 });
    doc.fillColor(RED).fontSize(10).font('Helvetica-Bold')
       .text(`– ${fcfa(order.commission_amount)}`, 250, y, { width: doc.page.width - 300 });
    y += 20;

    // Séparateur
    doc.rect(58, y, doc.page.width - 116, 1).fill('#e2e8f0');
    y += 8;

    // Montant net
    doc.fillColor(GREY).fontSize(11).font('Helvetica')
       .text('Votre part (montant reçu)', 58, y, { width: 180 });
    doc.rect(248, y - 3, doc.page.width - 298, 24).fill('#ecfdf5');
    doc.fillColor(GREEN).fontSize(13).font('Helvetica-Bold')
       .text(fcfa(order.driver_amount), 250, y, { width: doc.page.width - 300 });
    y += 28;

    y = drawRow(doc, 'Mobile Money utilisé',
      order.driver_momo_provider === 'mtn' ? 'MTN MoMo'
      : order.driver_momo_provider === 'moov' ? 'Moov Money' : '—', y);
    y = drawRow(doc, 'Numéro Mobile Money', order.driver_momo_number || '—', y);
  }

  // ── Pied de page ─────────────────────────────────────────────────────────
  drawFooter(doc);

  doc.end();
};

module.exports = { generateReceiptPDF };
