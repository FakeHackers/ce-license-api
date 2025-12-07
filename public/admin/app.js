function getToken() {
  const t = document.getElementById("token").value;
  if (!t) {
    alert("Admin Token required");
    throw "NO_TOKEN";
  }
  return t;
}

function post(url, data) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getToken()
    },
    body: JSON.stringify(data || {})
  }).then(r => r.json());
}

function show(res) {
  document.getElementById("out").textContent =
    JSON.stringify(res, null, 2);
}

// ===== ACTIONS =====
function addLic() {
  post("/admin/add", {
    key: key.value,
    days: days.value
  }).then(show);
}

function ban() {
  post("/admin/ban", { key: key.value }).then(show);
}

function unban() {
  post("/admin/unban", { key: key.value }).then(show);
}

function resetHwid() {
  post("/admin/reset-hwid", { key: key.value }).then(show);
}

function backup() {
  fetch("/admin/download-json", {
    headers: { "x-admin-token": getToken() }
  })
  .then(r => r.text())
  .then(t => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t], { type:"application/json" }));
    a.download = "licenses.json";
    a.click();
  });
}
