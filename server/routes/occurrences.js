const express = require('express');
const { getDb, get, run } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All occurrence routes require authentication
router.use(authenticateToken);

/**
 * GET /api/occurrences
 * List all occurrences with optional filters.
 * Query: ?status=ABERTA&prioridade=ALTA&vehicle_id=1&driver_id=1
 */
router.get('/', (req, res) => {
  const db = getDb();
  const { status, prioridade, vehicle_id, driver_id } = req.query;

  let sql = `
    SELECT o.*,
      v.placa AS vehicle_placa,
      v.modelo AS vehicle_modelo,
      d.nome AS driver_nome
    FROM occurrences o
    LEFT JOIN vehicles v ON v.id = o.vehicle_id
    LEFT JOIN drivers d ON d.id = o.driver_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ' AND o.status = ?';
    params.push(status);
  }
  if (prioridade) {
    sql += ' AND o.prioridade = ?';
    params.push(prioridade);
  }
  if (vehicle_id) {
    sql += ' AND o.vehicle_id = ?';
    params.push(vehicle_id);
  }
  if (driver_id) {
    sql += ' AND o.driver_id = ?';
    params.push(driver_id);
  }

  sql += ' ORDER BY o.created_at DESC';

  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  res.json(rows);
});

/**
 * GET /api/occurrences/:id
 * Get occurrence by ID
 */
router.get('/:id', (req, res) => {
  const occurrence = get(
    `SELECT o.*,
      v.placa AS vehicle_placa,
      v.modelo AS vehicle_modelo,
      d.nome AS driver_nome
    FROM occurrences o
    LEFT JOIN vehicles v ON v.id = o.vehicle_id
    LEFT JOIN drivers d ON d.id = o.driver_id
    WHERE o.id = ?`,
    [req.params.id]
  );

  if (!occurrence) {
    return res.status(404).json({ error: 'Ocorrência não encontrada' });
  }

  res.json(occurrence);
});

/**
 * POST /api/occurrences
 * Create a new occurrence linked to a checklist.
 * vehicle_id and driver_id are inherited from the checklist.
 * Body: { checklist_id, titulo, descricao, categoria?, prioridade? }
 */
router.post('/', (req, res) => {
  const { checklist_id, titulo, descricao, categoria, prioridade } = req.body;

  if (!checklist_id) {
    return res.status(400).json({ error: 'checklist_id é obrigatório. Toda ocorrência deve nascer de um checklist.' });
  }

  if (!titulo || !descricao) {
    return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
  }

  // Validate checklist and get vehicle_id/driver_id
  const checklist = get('SELECT id, vehicle_id, driver_id FROM checklists WHERE id = ?', [checklist_id]);
  if (!checklist) {
    return res.status(404).json({ error: 'Checklist não encontrado' });
  }

  try {
    run(
      `INSERT INTO occurrences (titulo, descricao, checklist_id, vehicle_id, driver_id, categoria, prioridade)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        titulo,
        descricao,
        checklist_id,
        checklist.vehicle_id,
        checklist.driver_id,
        categoria || null,
        prioridade || 'MEDIA'
      ]
    );

    const occurrence = get(
      `SELECT o.*,
        v.placa AS vehicle_placa,
        v.modelo AS vehicle_modelo,
        d.nome AS driver_nome
      FROM occurrences o
      LEFT JOIN vehicles v ON v.id = o.vehicle_id
      LEFT JOIN drivers d ON d.id = o.driver_id
      WHERE o.id = (SELECT MAX(id) FROM occurrences)`
    );
    res.status(201).json(occurrence);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar ocorrência' });
  }
});

/**
 * PUT /api/occurrences/:id
 * Update an occurrence
 * Body: { titulo?, descricao?, categoria?, prioridade?, status?, vehicle_id?, driver_id? }
 */
router.put('/:id', (req, res) => {
  const occurrence = get('SELECT * FROM occurrences WHERE id = ?', [req.params.id]);
  if (!occurrence) {
    return res.status(404).json({ error: 'Ocorrência não encontrada' });
  }

  const { titulo, descricao, categoria, prioridade, status, vehicle_id, driver_id } = req.body;

  try {
    run(
      `UPDATE occurrences SET
        titulo = ?, descricao = ?, categoria = ?, prioridade = ?,
        status = ?, vehicle_id = ?, driver_id = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        titulo || occurrence.titulo,
        descricao || occurrence.descricao,
        categoria !== undefined ? categoria : occurrence.categoria,
        prioridade || occurrence.prioridade,
        status || occurrence.status,
        vehicle_id !== undefined ? vehicle_id : occurrence.vehicle_id,
        driver_id !== undefined ? driver_id : occurrence.driver_id,
        req.params.id
      ]
    );

    const updated = get('SELECT * FROM occurrences WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar ocorrência' });
  }
});

/**
 * PUT /api/occurrences/:id/resolver
 * Mark occurrence as resolved
 * Body: { resolucao }
 */
router.put('/:id/resolver', (req, res) => {
  const occurrence = get('SELECT * FROM occurrences WHERE id = ?', [req.params.id]);
  if (!occurrence) {
    return res.status(404).json({ error: 'Ocorrência não encontrada' });
  }

  if (occurrence.status === 'RESOLVIDA') {
    return res.status(400).json({ error: 'Ocorrência já está resolvida' });
  }

  const { resolucao } = req.body;
  if (!resolucao) {
    return res.status(400).json({ error: 'Resolução é obrigatória para resolver a ocorrência' });
  }

  try {
    run(
      `UPDATE occurrences SET
        status = 'RESOLVIDA',
        resolucao = ?,
        resolved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [resolucao, req.params.id]
    );

    const updated = get('SELECT * FROM occurrences WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao resolver ocorrência' });
  }
});

module.exports = router;
