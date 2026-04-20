const { getDb, save } = require('./connection');

/**
 * Initialize all database tables.
 * Safe to call multiple times — uses IF NOT EXISTS.
 * Must be called AFTER initDb().
 */
function initSchema() {
  const db = getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('ADMIN', 'MOTORISTA')) NOT NULL,
      status TEXT CHECK(status IN ('ATIVO', 'INATIVO')) DEFAULT 'ATIVO',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placa TEXT UNIQUE NOT NULL,
      modelo TEXT NOT NULL,
      marca TEXT,
      ano INTEGER,
      cor TEXT,
      km_atual REAL DEFAULT 0,
      status TEXT CHECK(status IN ('ATIVO', 'INATIVO')) DEFAULT 'ATIVO',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT UNIQUE NOT NULL,
      cnh_numero TEXT UNIQUE,
      cnh_categoria TEXT,
      cnh_validade DATE,
      telefone TEXT,
      status TEXT CHECK(status IN ('ATIVO', 'INATIVO')) DEFAULT 'ATIVO',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      data_checklist DATE DEFAULT (DATE('now')),
      km_saida REAL,
      km_chegada REAL,
      saida_em DATETIME,
      chegada_em DATETIME,
      tacografo_saida REAL,
      tacografo_chegada REAL,
      observacoes TEXT,
      status_final TEXT CHECK(status_final IN ('PENDENTE', 'EM_ROTA', 'APROVADO', 'REPROVADO', 'FINALIZADO')) DEFAULT 'PENDENTE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL,
      item_nome TEXT NOT NULL,
      etapa TEXT CHECK(etapa IN ('SAIDA', 'CHEGADA')) NOT NULL,
      status_item TEXT CHECK(status_item IN ('BOM', 'RUIM', 'NAO_TEM')) DEFAULT 'BOM',
      observacao_item TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER,
      vehicle_id INTEGER,
      driver_id INTEGER,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      categoria TEXT,
      prioridade TEXT CHECK(prioridade IN ('ALTA', 'MEDIA', 'BAIXA')) DEFAULT 'MEDIA',
      status TEXT CHECK(status IN ('ABERTA', 'EM_ANALISE', 'RESOLVIDA', 'CANCELADA')) DEFAULT 'ABERTA',
      resolucao TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );
  `);

  // Indexes for common queries
  db.run('CREATE INDEX IF NOT EXISTS idx_checklists_status ON checklists(status_final);');
  db.run('CREATE INDEX IF NOT EXISTS idx_checklists_vehicle ON checklists(vehicle_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_checklists_driver ON checklists(driver_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_checklist_items_etapa ON checklist_items(etapa);');
  db.run('CREATE INDEX IF NOT EXISTS idx_occurrences_status ON occurrences(status);');
  db.run('CREATE INDEX IF NOT EXISTS idx_occurrences_vehicle ON occurrences(vehicle_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_occurrences_driver ON occurrences(driver_id);');

  save();
  console.log('[DB] Schema initialized successfully');
}

module.exports = { initSchema };
