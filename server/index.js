const path = require('path');
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db/connection');
const { initSchema } = require('./db/schema');
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const driverRoutes = require('./routes/drivers');
const checklistRoutes = require('./routes/checklists');
const occurrenceRoutes = require('./routes/occurrences');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/occurrences', occurrenceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static frontend
app.use(express.static(publicDir));

// --- Initialize DB then start server ---
async function start() {
  try {
    await initDb();
    initSchema();

    app.listen(PORT, () => {
      console.log('');
      console.log('  ╔══════════════════════════════════════╗');
      console.log('  ║      Gestão de Frotas - Backend      ║');
      console.log(`  ║      http://localhost:${PORT}            ║`);
      console.log('  ╚══════════════════════════════════════╝');
      console.log('');
      console.log('  Endpoints disponíveis:');
      console.log('    POST /api/auth/login');
      console.log('    GET  /api/auth/me');
      console.log('    GET  /api/health');
      console.log('    CRUD /api/vehicles');
      console.log('    CRUD /api/drivers');
      console.log('    CRUD /api/checklists');
      console.log('    CRUD /api/occurrences');
      console.log('');
    });
  } catch (err) {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
  }
}

start();
