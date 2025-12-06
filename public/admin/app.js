const token = prompt("Admin Token");

function call(url, data) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token
    },
    body: JSON.stringify(data || {})
  }).then(r => r.json()).then(alert);
}

function add() {
  call("/admin/add", {
    key: key.value,
    days: days.value
  });
}

function ban() {
  call("/admin/ban", { key: key.value });
}

function backup() {
  window.location = "/admin/backup";
}
