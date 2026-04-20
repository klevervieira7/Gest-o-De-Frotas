const bcrypt = require('bcryptjs');
const { initDb, get, run } = require('./connection');
const { initSchema } = require('./schema');

// --- Default admin credentials ---
const ADMIN_USER = {
  nome: 'Administrador',
  username: 'admin',
  password: 'admin123',
  role: 'ADMIN'
};

async function seed() {
  // --- Initialize DB and schema ---
  await initDb();
  initSchema();

  // --- Insert admin (skip if already exists) ---
  const existing = get('SELECT id FROM users WHERE username = ?', [ADMIN_USER.username]);

  if (existing) {
    console.log(`[SEED] Usuário "${ADMIN_USER.username}" já existe (id: ${existing.id}). Nada alterado.`);
  } else {
    const hash = bcrypt.hashSync(ADMIN_USER.password, 10);

    run(
      'INSERT INTO users (nome, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [ADMIN_USER.nome, ADMIN_USER.username, hash, ADMIN_USER.role]
    );

    console.log('[SEED] Usuário admin criado');
  }

  console.log('');
  console.log('  Credenciais de teste:');
  console.log(`    username: ${ADMIN_USER.username}`);
  console.log(`    password: ${ADMIN_USER.password}`);
  console.log('');
}

seed().catch(err => {
  console.error('[SEED] Erro:', err);
  process.exit(1);
});
