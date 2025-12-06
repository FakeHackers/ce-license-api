const express = require("express");
const app = express();
const path = require("path");

app.use(express.static("public"));

const db = {
  "HUTAO1": { expire: "2026-12-31", hwid: null },
  "HUTAO2": { expire: "2025-12-31", hwid: null },
};

app.get("/check", (req, res) => {
  const { key, hwid } = req.query;
  if (!key || !hwid) return res.send("INVALID|PARAM");

  const lic = db[key];
  if (!lic) return res.send("INVALID|KEY");

  // realtime server date
  const today = new Date().toISOString().slice(0, 10);
  if (today > lic.expire) return res.send("EXPIRED");

  // HWID bind
  if (!lic.hwid) {
    lic.hwid = hwid;                 // bind pertama
  } else if (lic.hwid !== hwid) {
    return res.send("INVALID|HWID"); // pindah device
  }

  return res.send("VALID|" + lic.expire);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("License API running on", PORT));

