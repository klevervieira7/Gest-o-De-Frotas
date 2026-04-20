const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret';
const TOKEN_EXPIRY = '12h';

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, user: { id, nome, username, role } }
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password são obrigatórios' });
  }

  const user = get(
    'SELECT id, nome, username, password_hash, role, status FROM users WHERE username = ?',
    [username]
  );

  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  if (user.status !== 'ATIVO') {
    return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const payload = {
    id: user.id,
    nome: user.nome,
    username: user.username,
    role: user.role
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  res.json({
    token,
    user: {
      id: user.id,
      nome: user.nome,
      username: user.username,
      role: user.role
    }
  });
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 * Returns: { id, nome, username, role }
 */
router.get('/me', authenticateToken, (req, res) => {
  const user = get(
    'SELECT id, nome, username, role, status FROM users WHERE id = ?',
    [req.user.id]
  );

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  res.json({
    id: user.id,
    nome: user.nome,
    username: user.username,
    role: user.role
  });
});

module.exports = router;
