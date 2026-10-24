import api from './api';

const WIDGET_SRC = 'https://cdn.kkiapay.me/k.js';

const loadWidget = () => new Promise((resolve, reject) => {
  if (window.openKkiapayWidget) return resolve();
  const existing = document.querySelector(`script[src="${WIDGET_SRC}"]`);
  const script = existing || Object.assign(document.createElement('script'), { src: WIDGET_SRC, async: true });
  script.addEventListener('load', () => resolve());
  script.addEventListener('error', () => reject(new Error('Impossible de charger le module de paiement')));
  if (!existing) document.head.appendChild(script);
});

// k.js expose addSuccessListener/addFailedListener ; le SDK React utilise addKkiapayListener(event, cb)
const listen = (event, cb) => {
  if (event === 'success' && window.addSuccessListener) return window.addSuccessListener(cb);
  if (event === 'failed' && window.addFailedListener) return window.addFailedListener(cb);
  if (window.addKkiapayListener) return window.addKkiapayListener(event, cb);
};
const unlisten = (event, cb) => {
  if (window.removeKkiapayListener) window.removeKkiapayListener(event, cb);
};

/**
 * Ouvre le paiement KKiaPay pour une commande. L'argent est BLOQUÉ en séquestre sur BenneGo :
 * il n'est versé au chauffeur qu'après votre confirmation de réception.
 * @returns {Promise<{ok: boolean, cancelled?: boolean}>}
 */
export async function payOrder(orderId) {
  const { data: cfg } = await api.get(`/payments/orders/${orderId}/checkout`);

  // Développement local sans clé KKiaPay : simulation immédiate. Jamais dans un build de production.
  if (!cfg.api_key) {
    if (!import.meta.env.DEV) throw new Error('Paiement indisponible pour le moment');
    try {
      const mockTransId = `TEST_KKIAPAY_${Date.now()}`;
      await api.post(`/payments/orders/${orderId}/confirm`, { transaction_id: mockTransId });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  await loadWidget();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      unlisten('success', onSuccess);
      unlisten('failed', onFailed);
      resolve(result);
    };

    const onSuccess = async (response) => {
      try {
        await api.post(`/payments/orders/${orderId}/confirm`, { transaction_id: response.transactionId });
        finish({ ok: true });
      } catch {
        // Le webhook KKiaPay peut encore confirmer ; la page de commande revérifie l'état.
        finish({ ok: false });
      }
    };
    const onFailed = () => finish({ ok: false });

    listen('success', onSuccess);
    listen('failed', onFailed);

    window.openKkiapayWidget({
      amount: cfg.amount,
      api_key: cfg.api_key,
      sandbox: cfg.sandbox,
      phone: cfg.phone,
      name: cfg.name,
      data: cfg.order_id,        // renvoyé par le webhook pour retrouver la commande
      reason: `BenneGo ${cfg.order_number}`,
      theme: '#FF6B00',
    });
  });
}
