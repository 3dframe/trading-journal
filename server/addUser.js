const bcrypt = require("bcrypt");
const fs     = require("fs");
const path   = require("path");

const USERS_FILE = path.join(__dirname, "users.json");

const [,, username, password] = process.argv;
if (!username || !password) {
  console.error("Uso: node addUser.js <username> <password>");
  process.exit(1);
}

async function main() {
  const users = fs.existsSync(USERS_FILE)
    ? JSON.parse(fs.readFileSync(USERS_FILE, "utf8"))
    : [];

  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    console.error(`Utilizador "${username}" já existe.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  users.push({ username, passwordHash });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log(`✓ Utilizador "${username}" criado com sucesso.`);
}

main();
