const express = require("express");
const path = require("path");

const app = express();
const ADMIN_TOKEN = "HUTAO_ISTRI_HIRO";

// ================== DATABASE (sementara) ==================
const db = {
  "HUTAO1": { expire: "2026-12-31", hwid: null },
};

// ================== PUBLIC ==================
app.use(express.static("public"));
app.use("/script", express.static("public/script"));

// ================== ADMIN PANEL ==================
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin/index.html"));
});

// ================== LICENSE API ==================
app.get("/check", (req, res) => {
  const key  = req.query.key;
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

  // bind HWID
  if (!lic.hwid) {
    lic.hwid = hwid;
    console.log(`Bind key ${key}`);
  } else if (lic.hwid !== hwid) {
    return res.send("ERROR|HWID_MISMATCH|");
  }

  return res.send("VALID|OK|" + lic.expire);
});

// ================== RUN ==================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log("License API running on port", PORT)
);
