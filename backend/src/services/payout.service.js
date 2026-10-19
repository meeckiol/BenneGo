/**
 * Reversement de la part chauffeur (90 %).
 *
 * PAYOUT_MODE=manual (défaut) : l'argent reste sur le compte plateforme, le versement
 *   apparaît dans le tableau de bord admin ("À reverser") et l'admin le marque comme payé
 *   après l'avoir envoyé en Mobile Money (référence saisie, traçable).
 * PAYOUT_MODE=webhook : appelle PAYOUT_WEBHOOK_URL (votre propre service / agrégateur de
 *   payout) avec un identifiant d'idempotence = id de commande.
 *
 * Pour brancher un prestataire de virement automatique, implémenter `execute`.
 */
const axios = require('axios');

const mode = () => process.env.PAYOUT_MODE || 'manual';

/**
 * @returns {Promise<{status: 'pending'|'success', reference: string|null}>}
 */
const execute = async ({ orderId, orderNumber, amount, momoNumber, momoProvider }) => {
  if (mode() === 'webhook') {
    const res = await axios.post(
      process.env.PAYOUT_WEBHOOK_URL,
      {
        idempotency_key: `payout-${orderId}`,
        amount,
        currency: 'XOF',
        phone: momoNumber,
        network: String(momoProvider || '').toUpperCase(),
        reason: `LogiTruck - Course ${orderNumber}`,
      },
      {
        headers: { Authorization: `Bearer ${process.env.PAYOUT_WEBHOOK_TOKEN || ''}` },
        timeout: 15000,
      }
    );
    return { status: 'success', reference: res.data?.reference || res.data?.id || null };
  }
  return { status: 'pending', reference: null };
};

module.exports = { execute, mode };
