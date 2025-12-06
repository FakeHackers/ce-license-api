import express from "express";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

const LICENSES = {
  "HUTAO-TEST-001": "2026-12-31"
};

app.get("/api/check", (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).send("NO_KEY");

  const exp = LICENSES[key];
  if (!exp) return res.send("INVALID");

  return res.send(`VALID|${exp}`);
});

app.use("/script", express.static("public/script"));

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
