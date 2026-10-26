const { constantTimeEquals, createStaffToken } = require('../middlewares/staffAuth');

exports.login = (req, res) => {
  const { username, password } = req.body;
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const expectedUsername = process.env.STAFF_USERNAME || (isDevelopment ? 'admin_groove' : '');
  const expectedPassword = process.env.STAFF_PASSWORD || (isDevelopment ? 'space2026' : '');
  if (!expectedUsername || !expectedPassword || !process.env.STAFF_TOKEN_SECRET) {
    return res.status(503).json({ error: 'La autenticación de staff no está configurada en el servidor.' });
  }
  if (!constantTimeEquals(username, expectedUsername) || !constantTimeEquals(password, expectedPassword)) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }
  return res.status(200).json({ token: createStaffToken(username), expiresIn: 28800 });
};