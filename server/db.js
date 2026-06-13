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
  `);
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

  // Inicializa esquema para bases de dados novas
  if (!user?.dbPath) initSchema(db);

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
