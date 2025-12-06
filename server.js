const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== CONFIG ==================
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  throw new Error("ADMIN_TOKEN NOT SET");
}

// ================== DATABASE SQLITE ==================
const db = new Database("license.db");

// buat table kalau belum ada
db.prepare(`
CREATE TABLE IF NOT EXISTS licenses (
  key TEXT PRIMARY KEY,
  expire TEXT NOT NULL,
  hwid TEXT,
  banned INTEGER DEFAULT 0
)
`).run();

// ================== MIDDLEWARE AUTH ==================
function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  next();
}

// ================== LICENSE CHECK ==================
app.get("/check", (req, res) => {
  const { key, hwid } = req.query;
  if (!key || !hwid) return res.send("ERROR|PARAM|");

  const lic = db
    .prepare("SELECT * FROM licenses WHERE key = ?")
    .get(key);

  if (!lic) return res.send("ERROR|NO_KEY|");
  if (lic.banned) return res.send("ERROR|BANNED|");

  const today = new Date().toISOString().slice(0, 10);
  if (today > lic.expire) {
    return res.send("ERROR|EXPIRED|" + lic.expire);
  }

  // bind hwid pertama kali
  if (!lic.hwid) {
    db.prepare(
      "UPDATE licenses SET hwid = ? WHERE key = ?"
    ).run(hwid, key);
  } else if (lic.hwid !== hwid) {
    return res.send("ERROR|HWID_MISMATCH|");
  }

  return res.send("VALID|OK|" + lic.expire);
});

// ================== ADMIN APIs ==================
app.post("/admin/add", adminAuth, (req, res) => {
  const { key, days } = req.body;
  if (!key || !days) return res.json({ ok: false });

  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  const expire = d.toISOString().slice(0, 10);

  db.prepare(`
    INSERT OR REPLACE INTO licenses
    (key, expire, hwid, banned)
    VALUES (?, ?, NULL, 0)
  `).run(key, expire);

  res.json({ ok: true, action: "add", key, expire });
});

app.post("/admin/extend", adminAuth, (req, res) => {
  const { key, days } = req.body;

  const lic = db
    .prepare("SELECT * FROM licenses WHERE key = ?")
    .get(key);
  if (!lic) return res.json({ ok: false });

  const d = new Date(lic.expire);
  d.setDate(d.getDate() + Number(days));

  db.prepare(
    "UPDATE licenses SET expire = ? WHERE key = ?"
  ).run(d.toISOString().slice(0, 10), key);

  res.json({ ok: true, action: "extend", key });
});

app.post("/admin/ban", adminAuth, (req, res) => {
  const { key, state } = req.body;

  db.prepare(
    "UPDATE licenses SET banned = ? WHERE key = ?"
  ).run(state ? 1 : 0, key);

  res.json({ ok: true, action: "ban", key });
});

app.post("/admin/delete", adminAuth, (req, res) => {
  db.prepare(
    "DELETE FROM licenses WHERE key = ?"
  ).run(req.body.key);

  res.json({ ok: true, action: "delete" });
});

app.get("/admin/list", adminAuth, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM licenses")
    .all();

  res.json(rows);
});

// ================== STATIC ==================
app.use("/script", express.static("public/script"));
app.use(express.static("public"));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin/index.html"));
});

// ================== RUN ==================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("License API running on port", PORT);
});
