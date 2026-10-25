const mockVerify = jest.fn(async () => ({ status: 'SUCCESS', amount: 1000 }));
const mockRefund = jest.fn(async () => ({ status: 'SUCCESS' }));
jest.mock('@kkiapay-org/nodejs-sdk', () => ({
  kkiapay: jest.fn(() => ({ verify: mockVerify, refund: mockRefund })),
}));
jest.mock('../src/config/database', () => ({ query: jest.fn(), getClient: jest.fn() }));

describe('contournement KKiaPay hors production', () => {
  const OLD_ENV = { ...process.env };

  const loadProvider = (env) => {
    process.env = { ...OLD_ENV, KKIAPAY_PRIVATE_KEY: 'sk_test', ...env };
    jest.resetModules();
    return require('../src/providers/kkiapay');
  };

  beforeEach(() => {
    mockVerify.mockClear();
    mockRefund.mockClear();
  });

  afterAll(() => { process.env = OLD_ENV; });

  test('staging : un identifiant TEST_ est vérifié auprès de KKiaPay, jamais accepté localement', async () => {
    const provider = loadProvider({ NODE_ENV: 'staging' });
    await provider.verify('TEST_123');
    expect(mockVerify).toHaveBeenCalledWith('TEST_123');
  });

  test('développement sans KKIAPAY_DEV_BYPASS=true : vérification réelle', async () => {
    const provider = loadProvider({ NODE_ENV: 'development', KKIAPAY_DEV_BYPASS: undefined });
    await provider.verify('DEV_456');
    expect(mockVerify).toHaveBeenCalledWith('DEV_456');
  });

  test('développement avec KKIAPAY_DEV_BYPASS=true : contournement local autorisé', async () => {
    const provider = loadProvider({ NODE_ENV: 'development', KKIAPAY_DEV_BYPASS: 'true' });
    const result = await provider.verify('TEST_789');
    expect(result.status).toBe('SUCCESS');
    expect(mockVerify).not.toHaveBeenCalled();
  });

  test('un identifiant réel n\'est jamais contourné, même en développement', async () => {
    const provider = loadProvider({ NODE_ENV: 'development', KKIAPAY_DEV_BYPASS: 'true' });
    await provider.verify('kkia-real-transaction');
    expect(mockVerify).toHaveBeenCalledWith('kkia-real-transaction');
  });

  test('remboursement : même règle, staging appelle KKiaPay', async () => {
    const provider = loadProvider({ NODE_ENV: 'staging' });
    await provider.refund('TEST_999');
    expect(mockRefund).toHaveBeenCalledWith('TEST_999');
  });
});
