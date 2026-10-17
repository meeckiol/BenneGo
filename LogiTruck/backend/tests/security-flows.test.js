jest.mock('../src/config/database', () => ({ query: jest.fn(), getClient: jest.fn() }));

const { verifyWebhookSecret, extractOrderId } = require('../src/services/payment.service');
const { updateOrderStatus } = require('../src/controllers/order.controller');

describe('webhook KKiaPay', () => {
  const OLD = process.env.KKIAPAY_WEBHOOK_SECRET;
  afterEach(() => { process.env.KKIAPAY_WEBHOOK_SECRET = OLD; });

  test('accepte uniquement le bon secret (en-tête x-kkiapay-secret)', () => {
    process.env.KKIAPAY_WEBHOOK_SECRET = 'abc123';
    expect(verifyWebhookSecret('abc123')).toBe(true);
    expect(verifyWebhookSecret('abc124')).toBe(false);
    expect(verifyWebhookSecret('abc')).toBe(false);          // longueur différente : pas d'exception
    expect(verifyWebhookSecret(undefined)).toBe(false);
  });

  test('refuse TOUT si aucun secret n\'est configuré (plus de "return true" par défaut)', () => {
    delete process.env.KKIAPAY_WEBHOOK_SECRET;
    expect(verifyWebhookSecret('anything')).toBe(false);
    expect(verifyWebhookSecret('')).toBe(false);
  });

  test('extractOrderId lit un UUID brut ou un JSON, rejette le reste', () => {
    const id = '11111111-2222-4333-8444-555555555555';
    expect(extractOrderId({ stateData: id })).toBe(id);
    expect(extractOrderId({ data: JSON.stringify({ order_id: id }) })).toBe(id);
    expect(extractOrderId({ data: "'; DROP TABLE orders;--" })).toBeNull();
    expect(extractOrderId({})).toBeNull();
  });
});

describe('transitions de statut', () => {
  const run = async (user) => {
    const next = jest.fn();
    await updateOrderStatus(
      { user, params: { id: 'o1' }, body: { status: 'validated' }, app: { get: jest.fn() } }, {}, next
    );
    return next.mock.calls[0][0];
  };

  test('un client ne peut pas passer la commande à "validated" via la route de statut', async () => {
    const err = await run({ id: 'c1', role: 'client' });
    expect(err.statusCode).toBe(403);
  });

  test('un chauffeur ne peut pas se valider lui-même (ni libérer l\'argent)', async () => {
    const { getClient } = require('../src/config/database');
    const db = {
      query: jest.fn(async (sql) => (/SELECT \* FROM orders/.test(sql)
        ? { rows: [{ id: 'o1', driver_id: 'd1', status: 'delivered', payment_status: 'escrow_held' }] }
        : { rows: [] })),
      release: jest.fn(),
    };
    getClient.mockResolvedValue(db);
    const err = await run({ id: 'd1', role: 'driver' });
    expect(err.statusCode).toBe(400);
    expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE orders SET status'), expect.anything());
  });
});
