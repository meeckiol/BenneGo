/** Inscription précédée de la vérification SMS, comme dans l'application. Hors production, le code est lu dans le service SMS. */
const request = require('supertest');
const sms = require('../../src/services/sms.service');

const verifiedRegister = async (app, body) => {
  const requested = await request(app).post('/api/auth/otp/request').send({ phone: body.phone });
  if (requested.status !== 200) throw new Error(`OTP request: ${requested.status} ${JSON.stringify(requested.body)}`);
  const code = sms.lastMessageFor(body.phone).match(/(\d{6})/)[1];
  const verified = await request(app).post('/api/auth/otp/verify').send({ phone: body.phone, code });
  if (verified.status !== 200) throw new Error(`OTP verify: ${verified.status} ${JSON.stringify(verified.body)}`);
  return request(app).post('/api/auth/register').send(body);
};

module.exports = { verifiedRegister };
