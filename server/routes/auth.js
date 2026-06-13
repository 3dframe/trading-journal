const express = require("express");
const bcrypt  = require("bcrypt");
const fs      = require("fs");
const path    = require("path");

const router     = express.Router();
const USERS_FILE = path.join(__dirname, "..", "users.json");
const LOGS_FILE  = path.join(__dirname, "..", "logs", "access.json");

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function appendLog(entry) {
  const dir = path.dirname(LOGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const logs = fs.existsSync(LOGS_FILE)
    ? JSON.parse(fs.readFileSync(LOGS_FILE, "utf8"))
    : [];
  logs.push(entry);
  if (logs.length > 500) logs.splice(0, logs.length - 500);
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username e password obrigatórios." });
  if (username.length < 3)
    return res.status(400).json({ error: "Username deve ter pelo menos 3 caracteres." });
  if (password.length < 6)
    return res.status(400).json({ error: "Password deve ter pelo menos 6 caracteres." });

  const users = loadUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ error: "Utilizador já existe." });

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  users.push({ username, passwordHash, lastLogin: now });
  saveUsers(users);

  appendLog({ username, action: "register", timestamp: now, ip: req.ip });
  req.session.user = { username };
  res.json({ username });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username e password obrigatórios." });

  const users = loadUsers();
  const user  = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user)
    return res.status(401).json({ error: "Credenciais inválidas." });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    appendLog({ username: user.username, action: "login_failed", timestamp: new Date().toISOString(), ip: req.ip });
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const now = new Date().toISOString();
  user.lastLogin = now;
  saveUsers(users);
  appendLog({ username: user.username, action: "login", timestamp: now, ip: req.ip });

  req.session.user = { username: user.username, isAdmin: !!user.isAdmin };
  res.json({ username: user.username, isAdmin: !!user.isAdmin });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  const username = req.session?.user?.username;
  req.session.destroy(() => {
    if (username) appendLog({ username, action: "logout", timestamp: new Date().toISOString(), ip: req.ip });
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Não autenticado." });
  res.json({ username: req.session.user.username, isAdmin: !!req.session.user.isAdmin });
});

module.exports = router;
