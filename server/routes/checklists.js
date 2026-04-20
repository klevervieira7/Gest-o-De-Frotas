const express = require('express');
const { getDb, get, run, save } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// --- Default checklist items by etapa ---
// permite_nao_tem: true = item pode não existir no veículo

// SAIDA: inspeção pré-viagem — verifica se o veículo está apto a sair
const DEFAULT_ITEMS_SAIDA = [
  { nome: 'Sistemas de Freios',         permite_nao_tem: false },
  { nome: 'Motor em Geral',             permite_nao_tem: false },
  { nome: 'Sistema de Direção',          permite_nao_tem: false },
  { nome: 'Sistema de Embreagem',        permite_nao_tem: false },
  { nome: 'Limpador de Vidros',          permite_nao_tem: false },
  { nome: 'Sistema de Refrigeração',     permite_nao_tem: false },
  { nome: 'Nível de Água do Radiador',   permite_nao_tem: false },
  { nome: 'Nível do Líquido de Freio',   permite_nao_tem: false },
  { nome: 'Condições dos Retrovisores',  permite_nao_tem: false },
  { nome: 'Luz Alta',                    permite_nao_tem: false },
  { nome: 'Luz Baixa',                   permite_nao_tem: false },
  { nome: 'Setas',                       permite_nao_tem: false },
  { nome: 'Luz de Ré',                   permite_nao_tem: false },
  { nome: 'Nível do Óleo do Motor',      permite_nao_tem: false },
  { nome: 'Estepe',                      permite_nao_tem: true },
  { nome: 'Triângulo de Sinalização',    permite_nao_tem: true },
  { nome: 'Macaco Hidráulico',           permite_nao_tem: true },
  { nome: 'Cintas',                      permite_nao_tem: true },
  { nome: 'Capacete',                    permite_nao_tem: true },
  { nome: 'Pneus',                       permite_nao_tem: false },
  { nome: 'Lavagem e Limpeza',           permite_nao_tem: false }
];

// CHEGADA: inspeção de retorno — verifica estado do veículo após o dia
const DEFAULT_ITEMS_CHEGADA = [
  { nome: 'Sistemas de Freios',         permite_nao_tem: false },
  { nome: 'Motor em Geral',             permite_nao_tem: false },
  { nome: 'Pneus',                       permite_nao_tem: false },
  { nome: 'Condições dos Retrovisores',  permite_nao_tem: false },
  { nome: 'Luzes em Geral',              permite_nao_tem: false },
  { nome: 'Nível do Óleo do Motor',      permite_nao_tem: false },
  { nome: 'Nível de Água do Radiador',   permite_nao_tem: false },
  { nome: 'Avarias na Carroceria',       permite_nao_tem: false },
  { nome: 'Limpeza do Veículo',          permite_nao_tem: false },
  { nome: 'Estepe',                      permite_nao_tem: true },
  { nome: 'Triângulo de Sinalização',    permite_nao_tem: true },
  { nome: 'Macaco Hidráulico',           permite_nao_tem: true },
  { nome: 'Cintas',                      permite_nao_tem: true },
  { nome: 'Capacete',                    permite_nao_tem: true },
  { nome: 'Ferramentas e Acessórios',    permite_nao_tem: true }
];

// All checklist routes require authentication
router.use(authenticateToken);

/**
 * GET /api/checklists/items
 * Returns the default checklist items separated by etapa
 */
router.get('/items', (req, res) => {
  res.json({ saida: DEFAULT_ITEMS_SAIDA, chegada: DEFAULT_ITEMS_CHEGADA });
});

/**
 * GET /api/checklists
 * List all checklists with vehicle/driver info.
 * Optional query: ?status=PENDENTE&driver_id=1&vehicle_id=1
 */
router.get('/', (req, res) => {
  const db = getDb();
  const { status, driver_id, vehicle_id } = req.query;

  let sql = `
    SELECT c.*,
      v.placa AS vehicle_placa,
      v.modelo AS vehicle_modelo,
      d.nome AS driver_nome
    FROM checklists c
    LEFT JOIN vehicles v ON v.id = c.vehicle_id
    LEFT JOIN drivers d ON d.id = c.driver_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ' AND c.status_final = ?';
    params.push(status);
  }
  if (driver_id) {
    sql += ' AND c.driver_id = ?';
    params.push(driver_id);
  }
  if (vehicle_id) {
    sql += ' AND c.vehicle_id = ?';
    params.push(vehicle_id);
  }

  sql += ' ORDER BY c.created_at DESC';

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
 * GET /api/checklists/:id
 * Get checklist by ID with all items
 */
router.get('/:id', (req, res) => {
  const checklist = get(
    `SELECT c.*,
      v.placa AS vehicle_placa,
      v.modelo AS vehicle_modelo,
      d.nome AS driver_nome
    FROM checklists c
    LEFT JOIN vehicles v ON v.id = c.vehicle_id
    LEFT JOIN drivers d ON d.id = c.driver_id
    WHERE c.id = ?`,
    [req.params.id]
  );

  if (!checklist) {
    return res.status(404).json({ error: 'Checklist não encontrado' });
  }

  // Get items grouped by etapa
  const db = getDb();
  const stmtItems = db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY id');
  stmtItems.bind([req.params.id]);

  const items = [];
  while (stmtItems.step()) {
    items.push(stmtItems.getAsObject());
  }
  stmtItems.free();

  res.json({ ...checklist, items });
});

/**
 * POST /api/checklists
 * Create a new checklist
 * Body: { vehicle_id, driver_id, km_saida?, tacografo_saida?, observacoes? }
 */
router.post('/', (req, res) => {
  const { vehicle_id, driver_id, km_saida, tacografo_saida, observacoes } = req.body;

  if (!vehicle_id || !driver_id) {
    return res.status(400).json({ error: 'vehicle_id e driver_id são obrigatórios' });
  }

  if (!km_saida && km_saida !== 0) {
    return res.status(400).json({ error: 'km_saida é obrigatório na abertura do checklist' });
  }

  // Validate vehicle exists
  const vehicle = get('SELECT id FROM vehicles WHERE id = ?', [vehicle_id]);
  if (!vehicle) {
    return res.status(404).json({ error: 'Veículo não encontrado' });
  }

  // Validate driver exists
  const driver = get('SELECT id FROM drivers WHERE id = ?', [driver_id]);
  if (!driver) {
    return res.status(404).json({ error: 'Motorista não encontrado' });
  }

  try {
    run(
      `INSERT INTO checklists (vehicle_id, driver_id, km_saida, tacografo_saida, saida_em, observacoes, status_final)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'EM_ROTA')`,
      [vehicle_id, driver_id, km_saida || null, tacografo_saida || null, observacoes || null]
    );

    // Get the created checklist
    const checklist = get('SELECT * FROM checklists ORDER BY id DESC LIMIT 1');
    res.status(201).json(checklist);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar checklist' });
  }
});

/**
 * POST /api/checklists/:id/items
 * Save checklist items for a given etapa
 * Body: { etapa: "SAIDA"|"CHEGADA", items: [{ item_nome, status_item, observacao_item? }] }
 */
router.post('/:id/items', (req, res) => {
  const checklist = get('SELECT * FROM checklists WHERE id = ?', [req.params.id]);
  if (!checklist) {
    return res.status(404).json({ error: 'Checklist não encontrado' });
  }

  const { etapa, items } = req.body;

  if (!etapa || !['SAIDA', 'CHEGADA'].includes(etapa)) {
    return res.status(400).json({ error: 'Etapa deve ser SAIDA ou CHEGADA' });
  }

  // CHEGADA items require arrival data to be registered first
  if (etapa === 'CHEGADA' && !checklist.chegada_em) {
    return res.status(400).json({ error: 'Registre os dados de chegada (PUT /chegada) antes de preencher os itens de CHEGADA' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items deve ser um array não vazio' });
  }

  const db = getDb();

  try {
    // Remove existing items for this etapa (allow re-submission)
    db.run('DELETE FROM checklist_items WHERE checklist_id = ? AND etapa = ?', [req.params.id, etapa]);

    // Insert new items
    for (const item of items) {
      if (!item.item_nome) continue;

      db.run(
        `INSERT INTO checklist_items (checklist_id, item_nome, etapa, status_item, observacao_item)
         VALUES (?, ?, ?, ?, ?)`,
        [req.params.id, item.item_nome, etapa, item.status_item || 'BOM', item.observacao_item || null]
      );
    }

    // --- Auto-generate occurrences for RUIM items only ---
    const problemItems = items.filter(
      i => i.item_nome && i.status_item === 'RUIM'
    );

    const occurrencesCreated = [];
    for (const item of problemItems) {
      // Prevent duplicates: same checklist + item + etapa
      const existingStmt = db.prepare(
        `SELECT id FROM occurrences
         WHERE checklist_id = ? AND titulo = ? AND categoria = ?`
      );
      existingStmt.bind([req.params.id, item.item_nome, `${item.item_nome} - ${etapa}`]);
      const exists = existingStmt.step();
      existingStmt.free();

      if (!exists) {
        const descricao = item.observacao_item
          ? item.observacao_item
          : `Item "${item.item_nome}" reportado como RUIM na etapa ${etapa}`;

        db.run(
          `INSERT INTO occurrences (checklist_id, vehicle_id, driver_id, titulo, descricao, categoria, prioridade)
           VALUES (?, ?, ?, ?, ?, ?, 'ALTA')`,
          [
            req.params.id,
            checklist.vehicle_id,
            checklist.driver_id,
            item.item_nome,
            descricao,
            `${item.item_nome} - ${etapa}`
          ]
        );
        occurrencesCreated.push(item.item_nome);
      }
    }

    if (occurrencesCreated.length > 0) {
      console.log(`[CHECKLIST] ${occurrencesCreated.length} ocorrência(s) gerada(s): ${occurrencesCreated.join(', ')}`);
    }

    // Calculate status_final based on items
    const statusFinal = calculateStatus(req.params.id, db);

    db.run(
      'UPDATE checklists SET status_final = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [statusFinal, req.params.id]
    );

    save();

    // Return updated checklist with items
    const updated = get('SELECT * FROM checklists WHERE id = ?', [req.params.id]);

    const stmtItems = db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY id');
    stmtItems.bind([req.params.id]);
    const allItems = [];
    while (stmtItems.step()) {
      allItems.push(stmtItems.getAsObject());
    }
    stmtItems.free();

    res.json({ ...updated, items: allItems, occurrences_created: occurrencesCreated });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar itens do checklist' });
  }
});

/**
 * PUT /api/checklists/:id/chegada
 * Register arrival data
 * Body: { km_chegada?, tacografo_chegada?, observacoes? }
 */
router.put('/:id/chegada', (req, res) => {
  const checklist = get('SELECT * FROM checklists WHERE id = ?', [req.params.id]);
  if (!checklist) {
    return res.status(404).json({ error: 'Checklist não encontrado' });
  }

  const { km_chegada, tacografo_chegada, observacoes } = req.body;

  if (!km_chegada && km_chegada !== 0) {
    return res.status(400).json({ error: 'km_chegada é obrigatório para registrar a chegada' });
  }

  try {
    run(
      `UPDATE checklists SET
        km_chegada = ?, tacografo_chegada = ?,
        chegada_em = CURRENT_TIMESTAMP,
        observacoes = COALESCE(?, observacoes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [km_chegada || null, tacografo_chegada || null, observacoes || null, req.params.id]
    );

    const updated = get('SELECT * FROM checklists WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar chegada' });
  }
});

/**
 * Calculate status_final based on item responses and etapas present.
 * Only SAIDA items → EM_ROTA (vehicle is out)
 * CHEGADA items exist → APROVADO or REPROVADO based on ALL items
 * Any RUIM in any etapa → REPROVADO
 */
function calculateStatus(checklistId, db) {
  // Check if CHEGADA items exist
  const stmtChegada = db.prepare(
    "SELECT COUNT(*) AS c FROM checklist_items WHERE checklist_id = ? AND etapa = 'CHEGADA'"
  );
  stmtChegada.bind([checklistId]);
  stmtChegada.step();
  const chegadaCount = stmtChegada.getAsObject().c;
  stmtChegada.free();

  // Check for any RUIM items (both etapas)
  const stmtRuim = db.prepare(
    "SELECT COUNT(*) AS c FROM checklist_items WHERE checklist_id = ? AND status_item = 'RUIM'"
  );
  stmtRuim.bind([checklistId]);
  stmtRuim.step();
  const ruimCount = stmtRuim.getAsObject().c;
  stmtRuim.free();

  // If CHEGADA not yet filled, vehicle is still on the road
  if (chegadaCount === 0) {
    return ruimCount > 0 ? 'REPROVADO' : 'EM_ROTA';
  }

  // CHEGADA filled = checklist is finalized
  if (ruimCount > 0) return 'REPROVADO';
  return 'FINALIZADO';
}

module.exports = router;
