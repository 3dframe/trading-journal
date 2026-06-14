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
    CREATE TABLE IF NOT EXISTS depositos (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      data      TEXT,
      valor     REAL,
      tipo      TEXT,
      corretora TEXT,
      descricao TEXT
    );
  `);

  // 2. Migrations de colunas
  try { db.exec("ALTER TABLE trades ADD COLUMN ref_externa TEXT"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN fees REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN volume REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN valor_compra_eur REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN valor_venda_eur REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN moeda_original TEXT"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN tipo TEXT"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN pais TEXT"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN conta TEXT"); } catch {}

  // Migration: garantir que a coluna tipo_ordem existe (bases novas não a têm no CREATE TABLE)
  try { db.exec("ALTER TABLE trades ADD COLUMN tipo_ordem TEXT"); } catch {}
  // Copiar 'tipo' → 'tipo_ordem' para bases vindas do Python
  try { db.exec("UPDATE trades SET tipo_ordem = tipo WHERE tipo_ordem IS NULL AND tipo IS NOT NULL"); } catch {}

  // Migrations: campos para IRS fiscal e câmbio
  try { db.exec("ALTER TABLE trades ADD COLUMN swap        REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN rollover    REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN gross_pl    REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN taxa_cambio REAL"); } catch {}
  try { db.exec("ALTER TABLE dividendos ADD COLUMN tipo TEXT DEFAULT 'DIVIDEND'"); } catch {}

  // Migrations: campos completos do CLOSED POSITION HISTORY (XTB/IBKR)
  try { db.exec("ALTER TABLE trades ADD COLUMN preco_abertura REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN preco_fecho    REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN sl             REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN tp             REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN margin         REAL"); } catch {}
  try { db.exec("ALTER TABLE trades ADD COLUMN comment        TEXT"); } catch {}

  // 3. Índices únicos (só depois de garantir que as colunas existem)
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_ref
    ON trades(corretora, ref_externa) WHERE ref_externa IS NOT NULL`); } catch {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_divs_unique
    ON dividendos(simbolo, data_pagamento, corretora)`); } catch {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_depositos_unique
    ON depositos(data, valor, corretora, tipo)`); } catch {}
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
