const express = require('express');
const { getDb, get, run } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All driver routes require authentication
router.use(authenticateToken);

/**
 * GET /api/drivers
 * List all drivers. Optional query: ?status=ATIVO
 */
router.get('/', (req, res) => {
  const db = getDb();
  const { status } = req.query;

  let stmt;
  if (status) {
    stmt = db.prepare('SELECT * FROM drivers WHERE status = ? ORDER BY nome');
    stmt.bind([status]);
  } else {
    stmt = db.prepare('SELECT * FROM drivers ORDER BY nome');
  }

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  res.json(rows);
});

/**
 * GET /api/drivers/:id
 * Get driver by ID
 */
router.get('/:id', (req, res) => {
  const driver = get('SELECT * FROM drivers WHERE id = ?', [req.params.id]);

  if (!driver) {
    return res.status(404).json({ error: 'Motorista não encontrado' });
  }

  res.json(driver);
});

/**
 * POST /api/drivers
 * Create a new driver
 * Body: { nome, cpf, cnh_numero?, cnh_categoria?, cnh_validade?, telefone? }
 */
router.post('/', (req, res) => {
  const { nome, cpf, cnh_numero, cnh_categoria, cnh_validade, telefone } = req.body;

  if (!nome || !cpf) {
    return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
  }

  // Check for duplicate CPF
  const existingCpf = get('SELECT id FROM drivers WHERE cpf = ?', [cpf]);
  if (existingCpf) {
    return res.status(409).json({ error: 'Já existe um motorista com este CPF' });
  }

  // Check for duplicate CNH if provided
  if (cnh_numero) {
    const existingCnh = get('SELECT id FROM drivers WHERE cnh_numero = ?', [cnh_numero]);
    if (existingCnh) {
      return res.status(409).json({ error: 'Já existe um motorista com este número de CNH' });
    }
  }

  try {
    run(
      `INSERT INTO drivers (nome, cpf, cnh_numero, cnh_categoria, cnh_validade, telefone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, cpf, cnh_numero || null, cnh_categoria || null, cnh_validade || null, telefone || null]
    );

    const driver = get('SELECT * FROM drivers WHERE cpf = ?', [cpf]);
    res.status(201).json(driver);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar motorista' });
  }
});

/**
 * PUT /api/drivers/:id
 * Update a driver
 * Body: { nome?, cpf?, cnh_numero?, cnh_categoria?, cnh_validade?, telefone?, status? }
 */
router.put('/:id', (req, res) => {
  const driver = get('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
  if (!driver) {
    return res.status(404).json({ error: 'Motorista não encontrado' });
  }

  const { nome, cpf, cnh_numero, cnh_categoria, cnh_validade, telefone, status } = req.body;

  // If changing CPF, check for duplicates
  if (cpf && cpf !== driver.cpf) {
    const existing = get('SELECT id FROM drivers WHERE cpf = ? AND id != ?', [cpf, req.params.id]);
    if (existing) {
      return res.status(409).json({ error: 'Já existe um motorista com este CPF' });
    }
  }

  // If changing CNH, check for duplicates
  if (cnh_numero && cnh_numero !== driver.cnh_numero) {
    const existing = get('SELECT id FROM drivers WHERE cnh_numero = ? AND id != ?', [cnh_numero, req.params.id]);
    if (existing) {
      return res.status(409).json({ error: 'Já existe um motorista com este número de CNH' });
    }
  }

  try {
    run(
      `UPDATE drivers SET
        nome = ?, cpf = ?, cnh_numero = ?, cnh_categoria = ?,
        cnh_validade = ?, telefone = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nome || driver.nome,
        cpf || driver.cpf,
        cnh_numero !== undefined ? cnh_numero : driver.cnh_numero,
        cnh_categoria !== undefined ? cnh_categoria : driver.cnh_categoria,
        cnh_validade !== undefined ? cnh_validade : driver.cnh_validade,
        telefone !== undefined ? telefone : driver.telefone,
        status || driver.status,
        req.params.id
      ]
    );

    const updated = get('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar motorista' });
  }
});

/**
 * DELETE /api/drivers/:id
 * Delete a driver
 */
router.delete('/:id', (req, res) => {
  const driver = get('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
  if (!driver) {
    return res.status(404).json({ error: 'Motorista não encontrado' });
  }

  try {
    run('DELETE FROM drivers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Motorista removido com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover motorista' });
  }
});

module.exports = router;
