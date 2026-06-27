const express      = require("express");
const cors         = require("cors");
const path         = require("path");
const fs           = require("fs");
const os           = require("os");
const session      = require("express-session");
const FileStore    = require("session-file-store")(session);
const fx           = require("./fx");
const requireAuth  = require("./middleware/requireAuth");
const requireAdmin = require("./middleware/requireAdmin");

const app  = express();
const PORT = 3001;
// IMPORTANTE: as sessões ficam FORA do OneDrive. Quando a pasta está dentro do OneDrive,
// a sincronização bloqueia o rename atómico do session-file-store (escreve <id>.json.<rnd>
// e renomeia para <id>.json) → erro EPERM. Sob reinícios rápidos do nodemon isso degenera
// numa cascata de erros que acaba por derrubar o processo (login deixa de responder).
// Guardar numa pasta local não sincronizada (LOCALAPPDATA, com fallback para o tmp) resolve.
const SESSIONS_DIR = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "trading-journal", "sessions");
try { fs.mkdirSync(SESSIONS_DIR, { recursive: true }); } catch {}

// Rede de segurança: erros transitórios de I/O do store de sessões (EPERM/ENOENT no rename
// atómico, típicos de Windows/OneDrive) não devem derrubar o processo. Qualquer outra
// exceção não tratada mantém o comportamento normal (log + saída).
process.on("uncaughtException", (err) => {
  const txt = `${err && err.path || ""} ${err && err.message || ""}`;
  if (err && (err.code === "EPERM" || err.code === "ENOENT") && /session/i.test(txt)) {
    console.warn("[sessões] erro de I/O transitório ignorado:", err.message);
    return;
  }
  console.error("Exceção não tratada:", err);
  process.exit(1);
});

// O session-file-store grava de forma atómica (escreve <id>.json.<random> e depois
// renomeia para <id>.json). Em Windows o rename por vezes falha e deixa esses ficheiros
// temporários para trás. O reaper interno só apaga ficheiros que terminam em ".json",
// pelo que estes órfãos acumulam-se indefinidamente. Limpamo-los nós. As sessões .json
// expiradas continuam a ser tratadas pelo reaper da biblioteca (usa o maxAge do cookie).
function cleanOrphanSessionFiles() {
  fs.readdir(SESSIONS_DIR, (err, files) => {
    if (err) return;                                   // pasta ainda não existe — ok
    const now = Date.now();
    for (const f of files) {
      if (!/\.json\.\d+$/.test(f)) continue;           // só ficheiros temporários órfãos
      const fp = path.join(SESSIONS_DIR, f);
      fs.stat(fp, (e, st) => {
        if (e) return;
        if (now - st.mtimeMs > 60 * 1000) fs.unlink(fp, () => {});  // >60s = seguro apagar
      });
    }
  });
}

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:4173"],
  credentials: true,
}));
app.use(express.json());

app.use(session({
  store: new FileStore({
    path: SESSIONS_DIR,
    ttl: 24 * 60 * 60,       // sessão expira no servidor ao fim de 1 dia de inactividade
    reapInterval: 60 * 60,   // apaga sessões expiradas a cada hora
    logFn: () => {},
  }),
  secret: process.env.SESSION_SECRET || "trading-journal-secret-dev",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Sem maxAge → cookie de sessão: é apagado quando o browser fecha,
    // obrigando sempre a passar pelo login/password ao reabrir a aplicação.
  },
}));

// Rotas pÃºblicas
app.use("/api/auth", require("./routes/auth"));

// Rotas protegidas
app.use("/api/trades",    requireAuth, require("./routes/trades"));
app.use("/api/dividends", requireAuth, require("./routes/dividends"));
app.use("/api/irs",       requireAuth, require("./routes/irs"));
app.use("/api/admin",     requireAuth, requireAdmin, require("./routes/admin"));
app.use("/api/import",    requireAuth, require("./routes/import"));

// Em produÃ§Ã£o serve o React buildado
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

// Limpa ficheiros de sessão órfãos no arranque e periodicamente (complementa o reaper)
cleanOrphanSessionFiles();
setInterval(cleanOrphanSessionFiles, 60 * 60 * 1000).unref();

// Mantém os câmbios do BCE atualizados automaticamente (sem intervenção do utilizador).
// Só descarrega se a tabela estiver vazia/desatualizada. Desativável com FX_AUTO_UPDATE=0.
// O download não envia qualquer dado de operações — é só um ficheiro público (§6 OK).
fx.ensureFresh().then(r => {
  if (r.ok && r.inserted) console.log(`  Câmbios BCE atualizados: ${r.count} taxas até ${r.maxDate}`);
}).catch(() => {});
setInterval(() => fx.ensureFresh().catch(() => {}), 24 * 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`\n  Trading Journal API â†’ http://localhost:${PORT}\n`);
});
