jest.mock('../src/config/database', () => ({ query: jest.fn(), getClient: jest.fn() }));

const { canDriverTakeOrder } = require('../src/controllers/order.controller');
const { calculatePrice } = require('../src/services/pricing.service');

describe('transport léger : répartition des commandes', () => {
  test('un chauffeur de camionnette prend une commande légère', () => {
    expect(canDriverTakeOrder('pickup', 'pickup')).toBe(true);
  });

  test('un chauffeur de camionnette ne prend jamais une commande de camion', () => {
    expect(canDriverTakeOrder('simple_benne', 'pickup')).toBe(false);
    expect(canDriverTakeOrder('plateau', 'pickup')).toBe(false);
  });

  test('un camion ne prend jamais une commande légère', () => {
    expect(canDriverTakeOrder('pickup', 'simple_benne')).toBe(false);
    expect(canDriverTakeOrder('pickup', null)).toBe(false);
  });

  test('un chauffeur sans profil camion prend les commandes de camion', () => {
    expect(canDriverTakeOrder('double_benne', null)).toBe(true);
  });
});

describe('transport léger : tarif', () => {
  test('la camionnette coûte moins cher qu\'une benne pour la même course', () => {
    const course = { distance_km: 40, material_type: null };
    const pickup = calculatePrice({ ...course, truck_type: 'pickup' });
    const benne = calculatePrice({ ...course, truck_type: 'simple_benne' });

    expect(pickup.total_amount).toBeLessThan(benne.total_amount);
  });
});
