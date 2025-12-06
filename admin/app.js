const API = "/admin";

function q(id) {
  return document.getElementById(id).value;
}

function out(msg) {
  document.getElementById("output").textContent = msg;
}

async function send(path, params) {
  const url = `${API}/${path}?token=${q("token")}&${params}`;
  const res = await fetch(url);
  out(await res.text());
}

function addKey() {
  send("add", `key=${q("key")}&days=${q("days")}`);
}

function extendKey() {
  send("extend", `key=${q("key")}&days=${q("days")}`);
}

function resetHWID() {
  send("reset_hwid", `key=${q("key")}`);
}

function disableKey() {
  send("disable", `key=${q("key")}`);
}

function enableKey() {
  send("enable", `key=${q("key")}`);
}
