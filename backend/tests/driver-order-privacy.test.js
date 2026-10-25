jest.mock('../src/config/database', () => ({ query: jest.fn(), getClient: jest.fn() }));

const { query } = require('../src/config/database');
const { getOrder } = require('../src/controllers/order.controller');

const PENDING_ORDER = {
  id: 'o1',
  client_id: 'c1',
  driver_id: null,
  status: 'pending',
  payment_status: 'escrow_held',
  client_name: 'Ing. Koffi',
  client_phone: '+22997000000',
};

const fetchOrderAs = async (user, order = PENDING_ORDER) => {
  query.mockReset();
  query
    .mockResolvedValueOnce({ rows: [order] })
    .mockResolvedValueOnce({ rows: [] });
  const res = { json: jest.fn() };
  const next = jest.fn();
  await getOrder({ user, params: { id: order.id } }, res, next);
  return { body: res.json.mock.calls[0]?.[0], error: next.mock.calls[0]?.[0] };
};

describe('confidentialité des coordonnées client', () => {
  test('un chauffeur non assigné ne voit pas le téléphone ni le nom du client d\'une commande en attente', async () => {
    const { body } = await fetchOrderAs({ id: 'd2', role: 'driver' });

    expect(body.order.id).toBe('o1');
    expect(body.order).not.toHaveProperty('client_phone');
    expect(body.order).not.toHaveProperty('client_name');
  });

  test('le chauffeur assigné à la commande voit les coordonnées du client', async () => {
    const assigned = { ...PENDING_ORDER, driver_id: 'd1', status: 'driver_en_route_pickup' };
    const { body } = await fetchOrderAs({ id: 'd1', role: 'driver' }, assigned);

    expect(body.order.client_phone).toBe('+22997000000');
    expect(body.order.client_name).toBe('Ing. Koffi');
  });

  test('le client propriétaire garde ses propres coordonnées', async () => {
    const { body } = await fetchOrderAs({ id: 'c1', role: 'client' });

    expect(body.order.client_phone).toBe('+22997000000');
  });

  test('la liste des commandes masque le client aux chauffeurs non assignés', async () => {
    query.mockReset();
    query
      .mockResolvedValueOnce({ rows: [{ vehicle_category: 'TRUCK' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ ...PENDING_ORDER }] });
    const res = { json: jest.fn() };
    const { getOrders } = require('../src/controllers/order.controller');

    await getOrders({ user: { id: 'd2', role: 'driver' }, query: {} }, res, jest.fn());

    const [listed] = res.json.mock.calls[0][0].orders;
    expect(listed).not.toHaveProperty('client_phone');
    expect(listed).not.toHaveProperty('client_name');
  });
});
