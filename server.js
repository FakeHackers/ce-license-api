const express = require("express");
const app = express();

db = {
  "HUTAO1": { expire: "2026-12-31", hwid: null },
};

// ====== API LICENSE ======
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

  // cek expire pakai waktu server
  const today = new Date().toISOString().slice(0, 10);
  if (today > lic.expire) {
    return res.send("ERROR|EXPIRED|" + lic.expire);
  }

  // BIND HWID
  if (!lic.hwid) {
    // pertama kali dipakai → bind ke HWID ini
    lic.hwid = hwid;
    console.log(`Bind key ${key} ke hwid ${hwid}`);
  } else if (lic.hwid !== hwid) {
    // beda device
    return res.send("ERROR|HWID_MISMATCH|");
  }

  // sukses
  return res.send("VALID|OK|" + lic.expire);
});

// serve encrypted script
app.use("/script", express.static("public/script"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("License API running on port", PORT));
