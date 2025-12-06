const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= CONFIG =================
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) throw new Error("ADMIN_TOKEN NOT SET");

// ================= DATABASE =================
const db = new sqlite3.Database("./license.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      key TEXT PRIMARY KEY,
      expire TEXT,
      hwid_hash TEXT,
      banned INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      last_seen TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT,
      hwid_hash TEXT,
      ip TEXT,
      status TEXT,
      time TEXT
    )
  `);
});

// ================= UTIL =================
const hashHWID = (h) =>
  crypto.createHash("sha256").update(h).digest("hex");

// ================= ADMIN AUTH =================
function adminAuth(req, res, next) {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN)
    return res.status(401).json({ error: "UNAUTHORIZED" });
  next();
}

// ================= LICENSE CHECK =================
app.get("/check", (req, res) => {
  const { key, hwid } = req.query;
  if (!key || !hwid) return res.send("ERROR|PARAM|");

  const hwid_hash = hashHWID(hwid);
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now = new Date().toISOString();

  db.get("SELECT * FROM licenses WHERE key = ?", [key], (e, lic) => {
    if (!lic) {
      log("NO_KEY");
      return res.send("ERROR|NO_KEY|");
    }
    if (lic.banned) {
      log("BANNED");
      return res.send("ERROR|BANNED|");
    }
    if (now.slice(0,10) > lic.expire) {
      log("EXPIRED");
      return res.send("ERROR|EXPIRED|" + lic.expire);
    }

    if (!lic.hwid_hash) {
      db.run(
        "UPDATE licenses SET hwid_hash=?, use_count=use_count+1, last_seen=? WHERE key=?",
        [hwid_hash, now, key]
      );
    } else if (lic.hwid_hash !== hwid_hash) {
      log("HWID_MISMATCH");
      return res.send("ERROR|HWID_MISMATCH|");
    } else {
      db.run(
        "UPDATE licenses SET use_count=use_count+1, last_seen=? WHERE key=?",
        [now, key]
      );
    }

    log("OK");
    return res.send("VALID|OK|" + lic.expire);

    function log(status) {
      db.run(
        "INSERT INTO logs(key, hwid_hash, ip, status, time) VALUES(?,?,?,?,?)",
        [key, hwid_hash, ip, status, now]
      );
    }
  });
});

// ================= ADMIN API =================
app.post("/admin/add", adminAuth, (req, res) => {
  const { key, days } = req.body;
  const d = new Date();
  d.setDate(d.getDate() + Number(days));

  db.run(
    "INSERT OR REPLACE INTO licenses(key, expire, hwid_hash, banned, use_count) VALUES(?,?,?,?,?)",
    [key, d.toISOString().slice(0,10), null, 0, 0],
    () => res.json({ ok: true })
  );
});

app.post("/admin/ban", adminAuth, (req, res) => {
  db.run(
    "UPDATE licenses SET banned=1 WHERE key=?",
    [req.body.key],
    () => res.json({ ok: true })
  );
});

app.post("/admin/reset-hwid", adminAuth, (req, res) => {
  db.run(
    "UPDATE licenses SET hwid_hash=NULL WHERE key=?",
    [req.body.key],
    () => res.json({ ok: true, action: "reset_hwid" })
  );
});

app.post("/admin/unban", adminAuth, (req, res) => {
  db.run(
    "UPDATE licenses SET banned=0 WHERE key=?",
    [req.body.key],
    () => res.json({ ok: true, action: "unban" })
  );
});

app.post("/admin/delete", adminAuth, (req, res) => {
  db.run("DELETE FROM licenses WHERE key=?", [req.body.key]);
  res.json({ ok: true });
});

app.get("/admin/list", adminAuth, (req, res) => {
  db.all("SELECT * FROM licenses", (_, rows) => res.json(rows));
});

app.get("/admin/logs", adminAuth, (req, res) => {
  db.all("SELECT * FROM logs ORDER BY time DESC LIMIT 100", (_, rows) =>
    res.json(rows)
  );
});

// ================= ADMIN DOWNLOAD DB =================
app.get("/admin/download-db", adminAuth, (req, res) => {
  const dbPath = path.join(__dirname, "license.db");

  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: "DB_NOT_FOUND" });
  }

  res.download(dbPath, "license-backup.db", (err) => {
    if (err) {
      console.error("Download error:", err);
    }
  });
});

// ================= STATIC =================
app.use("/script", express.static("public/script"));
app.use(express.static("public"));
app.get("/admin", (_, res) =>
  res.sendFile(path.join(__dirname, "public/admin/index.html"))
);

// ================= RUN =================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("License API running on", PORT));
