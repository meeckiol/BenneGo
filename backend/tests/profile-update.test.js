jest.mock('../src/config/database', () => ({ query: jest.fn(), getClient: jest.fn() }));

const { query } = require('../src/config/database');
const { updateMe } = require('../src/controllers/auth.controller');

const mockRes = () => {
  const res = {};
  res.json = jest.fn(() => res);
  return res;
};

describe('informations personnelles', () => {
  beforeEach(() => jest.clearAllMocks());

  test('refuse une requête sans champ modifiable', async () => {
    const next = jest.fn();
    await updateMe({ user: { id: 'u1' }, body: { phone: '+22990000000' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(query).not.toHaveBeenCalled();
  });

  test('met à jour les champs reçus et recalcule le nom affiché, sans toucher au téléphone', async () => {
    query.mockResolvedValue({ rows: [{ id: 'u1', full_name: 'Koffi Ahouansou' }] });
    const res = mockRes();
    await updateMe({ user: { id: 'u1' }, body: { prenom: ' Koffi ', adresse: '', phone: '+229' } }, res, jest.fn());

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('prenom = $1');
    expect(sql).toContain('adresse = $2');
    expect(sql).toContain('full_name = TRIM(CONCAT(COALESCE($1');
    expect(sql).not.toContain('phone =');
    expect(params).toEqual(['Koffi', null, 'u1']);
    expect(res.json).toHaveBeenCalledWith({ user: { id: 'u1', full_name: 'Koffi Ahouansou' } });
  });
});
