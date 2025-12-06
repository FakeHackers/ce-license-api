const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== CONFIG ==================
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "HUTAO_ISTRI_HIRO";

// ================== DATABASE (sementara) ==================
const db = {};

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

  const lic = db[key];
  if (!lic) return res.send("ERROR|NO_KEY|");
  if (lic.banned) return res.send("ERROR|BANNED|");

  const today = new Date().toISOString().slice(0, 10);
  if (today > lic.expire) return res.send("ERROR|EXPIRED|" + lic.expire);

  if (!lic.hwid) {
    lic.hwid = hwid;
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

  db[key] = {
    expire: d.toISOString().slice(0, 10),
    hwid: null,
    banned: false
  };

  res.json({ ok: true, action: "add", key });
});

app.post("/admin/extend", adminAuth, (req, res) => {
  const { key, days } = req.body;
  if (!db[key]) return res.json({ ok: false });

  const d = new Date(db[key].expire);
  d.setDate(d.getDate() + Number(days));
  db[key].expire = d.toISOString().slice(0, 10);

  res.json({ ok: true, action: "extend", key });
});

app.post("/admin/ban", adminAuth, (req, res) => {
  const { key, state } = req.body;
  if (!db[key]) return res.json({ ok: false });

  db[key].banned = state === true;
  res.json({ ok: true, action: "ban", key, banned: db[key].banned });
});

app.post("/admin/delete", adminAuth, (req, res) => {
  delete db[req.body.key];
  res.json({ ok: true, action: "delete" });
});

app.get("/admin/list", adminAuth, (req, res) => {
  res.json(db);
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
