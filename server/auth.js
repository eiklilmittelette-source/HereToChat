const jwt = require('jsonwebtoken');

const JWT_SECRET = 'whatsapp-clone-secret-key-change-in-production';

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const user = verifyToken(header.split(' ')[1]);
  if (!user) {
    return res.status(401).json({ error: 'Token invalide' });
  }
  req.user = user;
  next();
}

module.exports = { generateToken, verifyToken, authMiddleware, JWT_SECRET };
