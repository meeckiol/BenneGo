jest.mock('../src/config/database', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../src/services/photo.service', () => ({
  uploadPhotos: { single: () => (req, res, next) => next() },
  saveImage: jest.fn(),
  hasImageSignature: jest.fn(),
  UPLOAD_DIR: '/tmp/unused',
}));

const { query } = require('../src/config/database');
const { saveImage } = require('../src/services/photo.service');
const { updateProfilePhoto } = require('../src/controllers/auth.controller');

const mockRes = () => {
  const res = {};
  res.json = jest.fn(() => res);
  return res;
};

describe('photo de profil', () => {
  beforeEach(() => jest.clearAllMocks());

  test('refuse une requête sans fichier', async () => {
    const next = jest.fn();
    await updateProfilePhoto({ user: { id: 'u1' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(query).not.toHaveBeenCalled();
  });

  test('enregistre la photo puis renvoie son adresse', async () => {
    saveImage.mockResolvedValue('/uploads/abc.jpg');
    query.mockResolvedValue({ rows: [] });
    const res = mockRes();
    const next = jest.fn();

    await updateProfilePhoto(
      { user: { id: 'u1' }, file: { buffer: Buffer.from([0xff, 0xd8, 0xff]), mimetype: 'image/jpeg' } },
      res,
      next
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('profile_photo_url'), ['/uploads/abc.jpg', 'u1']);
    expect(res.json).toHaveBeenCalledWith({ profile_photo_url: '/uploads/abc.jpg' });
    expect(next).not.toHaveBeenCalled();
  });

  test('transmet l\'erreur quand le fichier n\'est pas une image', async () => {
    const rejected = Object.assign(new Error('Fichier image invalide'), { statusCode: 400 });
    saveImage.mockRejectedValue(rejected);
    const next = jest.fn();

    await updateProfilePhoto({ user: { id: 'u1' }, file: { buffer: Buffer.from('texte'), mimetype: 'image/png' } }, mockRes(), next);

    expect(next).toHaveBeenCalledWith(rejected);
    expect(query).not.toHaveBeenCalled();
  });
});
