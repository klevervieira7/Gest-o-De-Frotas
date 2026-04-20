const express = require('express');
const { getDb, get, run, save } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All vehicle routes require authentication
router.use(authenticateToken);

/**
 * GET /api/vehicles
 * List all vehicles. Optional query: ?status=ATIVO
 */
router.get('/', (req, res) => {
  const db = getDb();
  const { status } = req.query;

  let stmt;
  if (status) {
    stmt = db.prepare('SELECT * FROM vehicles WHERE status = ? ORDER BY placa');
    stmt.bind([status]);
  } else {
    stmt = db.prepare('SELECT * FROM vehicles ORDER BY placa');
  }

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  res.json(rows);
});

/**
 * GET /api/vehicles/:id
 * Get vehicle by ID
 */
router.get('/:id', (req, res) => {
  const vehicle = get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);

  if (!vehicle) {
    return res.status(404).json({ error: 'Veículo não encontrado' });
  }

  res.json(vehicle);
});

/**
 * POST /api/vehicles
 * Create a new vehicle
 * Body: { placa, modelo, marca?, ano?, cor?, km_atual?, status? }
 */
router.post('/', (req, res) => {
  const { placa, modelo, marca, ano, cor, km_atual, status } = req.body;

  if (!placa || !modelo) {
    return res.status(400).json({ error: 'Placa e modelo são obrigatórios' });
  }

  // Check for duplicate placa
  const existing = get('SELECT id FROM vehicles WHERE placa = ?', [placa.toUpperCase()]);
  if (existing) {
    return res.status(409).json({ error: 'Já existe um veículo com esta placa' });
  }

  try {
    run(
      `INSERT INTO vehicles (placa, modelo, marca, ano, cor, km_atual, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [placa.toUpperCase(), modelo, marca || null, ano || null, cor || null, km_atual || 0, status || 'ATIVO']
    );

    // Get the created vehicle
    const vehicle = get('SELECT * FROM vehicles WHERE placa = ?', [placa.toUpperCase()]);
    res.status(201).json(vehicle);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar veículo' });
  }
});

/**
 * PUT /api/vehicles/:id
 * Update a vehicle
 * Body: { placa?, modelo?, marca?, ano?, cor?, km_atual?, status? }
 */
router.put('/:id', (req, res) => {
  const vehicle = get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!vehicle) {
    return res.status(404).json({ error: 'Veículo não encontrado' });
  }

  const { placa, modelo, marca, ano, cor, km_atual, status } = req.body;

  // If changing placa, check for duplicates
  if (placa && placa.toUpperCase() !== vehicle.placa) {
    const existing = get('SELECT id FROM vehicles WHERE placa = ? AND id != ?', [placa.toUpperCase(), req.params.id]);
    if (existing) {
      return res.status(409).json({ error: 'Já existe um veículo com esta placa' });
    }
  }

  try {
    run(
      `UPDATE vehicles SET
        placa = ?, modelo = ?, marca = ?, ano = ?, cor = ?,
        km_atual = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        placa ? placa.toUpperCase() : vehicle.placa,
        modelo || vehicle.modelo,
        marca !== undefined ? marca : vehicle.marca,
        ano !== undefined ? ano : vehicle.ano,
        cor !== undefined ? cor : vehicle.cor,
        km_atual !== undefined ? km_atual : vehicle.km_atual,
        status || vehicle.status,
        req.params.id
      ]
    );

    const updated = get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar veículo' });
  }
});

/**
 * DELETE /api/vehicles/:id
 * Delete a vehicle
 */
router.delete('/:id', (req, res) => {
  const vehicle = get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!vehicle) {
    return res.status(404).json({ error: 'Veículo não encontrado' });
  }

  try {
    run('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Veículo removido com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover veículo' });
  }
});

module.exports = router;
