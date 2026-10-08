const crypto = require('crypto');

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const { query } = require('../src/config/database');
const { updateOrderStatus } = require('../src/controllers/order.controller');
const { verifyKKiaPaySignature } = require('../src/services/payment.service');

describe('security flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('verifyKKiaPaySignature returns false without throwing on mismatched-length signatures', () => {
    process.env.KKIAPAY_SECRET = 'test-secret';
    const payload = { status: 'SUCCESS', transactionId: 'abc' };
    const signature = 'deadbeef';

    expect(() => verifyKKiaPaySignature(payload, signature)).not.toThrow();
    expect(verifyKKiaPaySignature(payload, signature)).toBe(false);
  });

  test('client cannot validate an order that is assigned to another driver', async () => {
    query.mockResolvedValue({
      rows: [{
        id: 'order-123',
        driver_id: 'driver-456',
        client_id: 'client-111',
        status: 'delivered',
        driver_amount: 50000,
      }],
    });

    const req = {
      user: { id: 'client-789', role: 'client' },
      params: { id: 'order-123' },
      body: { status: 'validated' },
      app: { get: jest.fn() },
    };

    const res = {};
    const next = jest.fn();

    await updateOrderStatus(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE orders SET status = $1'),
      expect.any(Array)
    );
  });
});
