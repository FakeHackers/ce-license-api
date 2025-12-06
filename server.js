const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// ===== CONFIG =====
const ADMIN_TOKEN = "HUTAO_ISTRI_HIRO";

// ===== DB SEMENTARA =====
const db = {
  "HUTAO1": { expire: "2026-12-31", hwid: null },
};

// ===== STATIC =====
app.use(express.static("public"));
app.use("/script", express.static("public/script"));

// ===== ADMIN PANEL =====
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin/index.html"));
});

// ===== ADD LICENSE (ADMIN) =====
app.post("/admin/add", (req, res) => {
  const token = req.headers["x-admin-token"];
  const { key, days } = req.body;

  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  if (!key || !days) {
    return res.json({ error: "PARAM" });
  }

  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  const exp = d.toISOString().slice(0, 10);

  db[key] = { expire: exp, hwid: null };
  console.log("Admin add key:", key, exp);

  res.json({ ok: true, key, expire: exp });
});

// ===== CHECK LICENSE =====
app.get("/check", (req, res) => {
  const key = req.query.key;
  const hwid = req.query.hwid;

  if (!key || !hwid) {
    return res.send("ERROR|PARAM|");
  }

  const lic = db[key];
  if (!lic) {
    return res.send("ERROR|NO_KEY|");
  }

  const today = new Date().toISOString().slice(0, 10);
  if (today > lic.expire) {
    return res.send("ERROR|EXPIRED|" + lic.expire);
  }

  if (!lic.hwid) {
    lic.hwid = hwid;
    console.log("Bind HWID for", key);
  } else if (lic.hwid !== hwid) {
    return res.send("ERROR|HWID_MISMATCH|");
  }

  return res.send("VALID|OK|" + lic.expire);
});

// ===== RUN =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("License API running on", PORT);
});
