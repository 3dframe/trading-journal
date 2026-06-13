const { DatabaseSync } = require("node:sqlite");
const path = require("path");

// Aponta para a base de dados existente da app Python
const DB_PATH = path.join(
  "H:\\Nuvem\\Google Drive\\O meu disco\\trading_app\\data\\trading.db"
);

let _db = null;

function getDb() {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA journal_mode = WAL");
  }
  return _db;
}

module.exports = { getDb };
