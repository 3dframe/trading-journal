const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs   = require("fs");

const DATA_DIR   = path.join(__dirname, "data");
const USERS_FILE = path.join(__dirname, "users.json");

const _dbs = {}; // cache de ligações por utilizador

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function initSchema(db) {
  // 1. Criar tabelas base (sem colunas novas — IF NOT EXISTS não as altera)
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      simbolo          TEXT,
      data_abertura    TEXT,
      data_fecho       TEXT,
      pl_eur           REAL,
      valor_compra_eur REAL,
      valor_venda_eur  REAL,
      pais             TEXT,
      moeda_original   TEXT,
      conta            TEXT,
      corretora        TEXT,
      categoria        TEXT,
      tipo             TEXT,
      volume           REAL,
      fees             REAL
    );
    CREATE TABLE IF NOT EXISTS dividendos (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      simbolo          TEXT,
      data_pagamento   TEXT,
      valor_bruto_eur  REAL,
      retencao_eur     REAL,
      valor_liq_eur    REAL,
      pais_fonte       TEXT,
      moeda            TEXT,
      corretora        TEXT
    );
    CREATE TABLE IF NOT EXISTS import_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      filename    TEXT,
      corretora   TEXT,
      n_trades    INTEGER DEFAULT 0,
      n_dividends INTEGER DEFAULT 0,
      n_skipped   INTEGER DEFAULT 0,
      imported_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // 2. Migrations de colunas (primeiro as colunas, depois os índices que dependem delas)
  try { db.exec("ALTER TABLE trades ADD COLUMN ref_externa TEXT"); } catch {}

  // 3. Índices únicos (só depois de garantir que as colunas existem)
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_ref
    ON trades(corretora, ref_externa) WHERE ref_externa IS NOT NULL`); } catch {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_divs_unique
    ON dividendos(simbolo, data_pagamento, corretora)`); } catch {}
}

function getDb(username) {
  if (_dbs[username]) return _dbs[username];

  const users  = loadUsers();
  const user   = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  let dbPath;

  if (user?.dbPath) {
    // Utilizador com base de dados própria configurada (ex: pcarmo1976 → Google Drive)
    dbPath = user.dbPath;
  } else {
    // Utilizador novo → base de dados vazia em server/data/<username>.db
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    dbPath = path.join(DATA_DIR, `${username}.db`);
  }

  const db = new DatabaseSync(dbPath.replace(/\\/g, "/"));
  db.exec("PRAGMA journal_mode = WAL");
  initSchema(db);

  _dbs[username] = db;
  return db;
}

function clearDb(username) {
  if (_dbs[username]) {
    try { _dbs[username].close(); } catch {}
    delete _dbs[username];
  }
}

module.exports = { getDb, clearDb };
