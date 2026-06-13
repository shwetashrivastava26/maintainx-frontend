/* =====================================
   API CONFIGURATION
   Set API_BASE to your backend's base URL.
   All endpoints follow REST conventions:
     GET    /api/{resource}       → fetch all
     POST   /api/{resource}       → create
     PUT    /api/{resource}/:id   → update
     DELETE /api/{resource}/:id   → delete
===================================== */

// const API_BASE = "http://localhost:8080/api";
const API_BASE = "https://maintainx-production.up.railway.app/api";

/* =====================================
   GENERIC API HELPERS
===================================== */

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API error ${res.status}: ${err}`);
    }
    // 204 No Content
    if (res.status === 204) return null;
    return await res.json();
  } catch (e) {
    showToast("API Error: " + e.message, "error");
    console.error(e);
    throw e;
  }
}

const apiGet    = (path)           => apiFetch(path);
const apiPost   = (path, body)     => apiFetch(path, { method: "POST",   body: JSON.stringify(body) });
const apiPut    = (path, body)     => apiFetch(path, { method: "PUT",    body: JSON.stringify(body) });
const apiDelete = (path)           => apiFetch(path, { method: "DELETE" });

/* =====================================
   IN-MEMORY CACHE
   Populated on page load from the API.
   Local mutations keep the cache in sync
   so the rest of the UI logic is unchanged.
===================================== */

let machines  = [];
async function fetchMachines() {
    try {
        const response = await fetch("http://localhost:8080/api/machines");
        machines = await response.json();

        loadMachines();
        updateDashboard();
        updateCharts();

        console.log("Machines loaded:", machines);
    } catch (error) {
  console.error("Error loading machines:", error);
  document.getElementById("machineTableBody").innerHTML = 
    `<tr><td colspan="6" style="color:red; text-align:center">
      ⚠️ Server unreachable — please start Spring Boot
    </td></tr>`;
}
}
let logs      = [];
let tickets   = [];
let parts     = [];
let auditLogs = [];



/* =====================================
   CHART INSTANCES
===================================== */

let machineStatusChart  = null;
let costByMonthChart    = null;
let ticketPriorityChart = null;

/* =====================================
   CHART 1 — Machine Status (Pie)
===================================== */

function drawMachineStatusChart() {
  const ctx = document.getElementById("machineStatusChart");
  if (!ctx) return;

  const active  = machines.filter(m => m.status === "Active").length;
  const due     = machines.filter(m => m.status === "Due Maintenance").length;
  const overdue = machines.filter(m => m.status === "Overdue").length;
  const repair  = machines.filter(m => m.status === "Under Repair").length;

  if (machineStatusChart) machineStatusChart.destroy();

  machineStatusChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Active", "Due Maintenance", "Overdue", "Under Repair"],
      datasets: [{
        data: [active, due, overdue, repair],
        backgroundColor: ["#166534", "#92400e", "#b91c1c", "#1d4ed8"],
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "Machine Status Breakdown", font: { size: 15 } }
      }
    }
  });
}

/* =====================================
   CHART 2 — Cost by Month (Bar)
===================================== */

function drawCostByMonthChart() {
  const ctx = document.getElementById("costByMonthChart");
  if (!ctx) return;

  const monthMap = {};
  logs.forEach(log => {
    if (!log.date) return;
    const d     = new Date(log.date);
    const label = d.toLocaleString("default", { month: "short", year: "numeric" });
    monthMap[label] = (monthMap[label] || 0) + (parseFloat(log.cost) || 0);
  });

  const sortedKeys = Object.keys(monthMap).sort((a, b) => new Date(a) - new Date(b));
  const labels     = sortedKeys;
  const data       = sortedKeys.map(k => monthMap[k]);

  if (costByMonthChart) costByMonthChart.destroy();

  costByMonthChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.length ? labels : ["No Data"],
      datasets: [{
        label: "Maintenance Cost (₹)",
        data: data.length ? data : [0],
        backgroundColor: "#2563eb",
        borderRadius: 6,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Monthly Maintenance Cost", font: { size: 15 } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: val => "₹" + val } }
      }
    }
  });
}

/* =====================================
   CHART 3 — Ticket Priority (Doughnut)
===================================== */

function drawTicketPriorityChart() {
  const ctx = document.getElementById("ticketPriorityChart");
  if (!ctx) return;

  const low      = tickets.filter(t => t.priority === "Low").length;
  const medium   = tickets.filter(t => t.priority === "Medium").length;
  const high     = tickets.filter(t => t.priority === "High").length;
  const critical = tickets.filter(t => t.priority === "Critical").length;

  if (ticketPriorityChart) ticketPriorityChart.destroy();

  ticketPriorityChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Low", "Medium", "High", "Critical"],
      datasets: [{
        data: [low, medium, high, critical],
        backgroundColor: ["#166534", "#d97706", "#ea580c", "#b91c1c"],
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "Ticket Priority Distribution", font: { size: 15 } }
      }
    }
  });
}

/* =====================================
   UPDATE ALL CHARTS
===================================== */

function updateCharts() {
  drawMachineStatusChart();
  drawCostByMonthChart();
  drawTicketPriorityChart();
}

/* =====================================
   MACHINE REGISTRY — RENDER
===================================== */

function loadMachines() {
  const table = document.getElementById("machineTableBody");
  if (!table) return;

  table.innerHTML = "";

  machines.forEach(machine => {
    const row = table.insertRow();
    row.innerHTML = `
      <td>${machine.id}</td>
      <td>${machine.code}</td>
      <td>${machine.block}</td>
      <td>${machine.machine}</td>
      <td class="${
        machine.status === "Active"          ? "status-active"  :
        machine.status === "Due Maintenance" ? "status-due"     :
        machine.status === "Overdue"         ? "status-overdue" :
        "status-repair"
      }">${machine.status}</td>
      <td>
        <button onclick="editRow(this)">Edit</button>
        <button onclick="deleteRow(this)">Delete</button>
      </td>
    `;
  });
}

/* =====================================
   ADD MACHINE
===================================== */

async function addMachine() {
  const code    = document.getElementById("machineCode").value.trim();
  const block   = document.getElementById("block").value.trim();
  const machine = document.getElementById("machineName").value.trim();
  const status  = document.getElementById("machineStatus").value;

  if (!code || !block || !machine) {
    showToast("Fill all fields", "error");
    return;
  }

  try {
    const created = await apiPost("/machines", { code, block, machine, status });
    machines.push(created);

    loadMachines();
    updateDashboard();
    updateCharts();
    ////addAudit("Machine Added : " + machine);
    showToast("Machine added successfully");

    document.getElementById("machineCode").value = "";
    document.getElementById("block").value       = "";
    document.getElementById("machineName").value = "";
  } catch (_) { /* error already shown by apiFetch */ }
}

/* =====================================
   DELETE MACHINE
===================================== */

async function deleteRow(button) {
  const row = button.parentNode.parentNode;
  const id  = parseInt(row.cells[0].innerHTML);

  try {
    await apiDelete("/machines/" + id);
    machines = machines.filter(m => m.id !== id);

    loadMachines();
    updateDashboard();
    updateCharts();
    ////addAudit("Machine Deleted ID : " + id);
    showToast("Machine deleted", "error");
  } catch (_) {}
}

/* =====================================
   EDIT MACHINE
===================================== */

async function editRow(button) {
  const row     = button.parentNode.parentNode;
  const id      = parseInt(row.cells[0].innerHTML);
  const machine = machines.find(m => m.id === id);
  if (!machine) return;

  const code   = prompt("Machine Code",   machine.code);
  const block  = prompt("Block",          machine.block);
  const name   = prompt("Machine Name",   machine.machine);
  const status = prompt("Status (Active / Due Maintenance / Overdue / Under Repair)", machine.status);

  const updated = {
    code:    code   || machine.code,
    block:   block  || machine.block,
    machine: name   || machine.machine,
    status:  status || machine.status
  };

  try {
    const result = await apiPut("/machines/" + id, updated);
    Object.assign(machine, result);

    loadMachines();
    updateDashboard();
    updateCharts();
    //addAudit("Machine Updated : " + machine.machine);
    showToast("Machine updated");
  } catch (_) {}
}

/* =====================================
   SEARCH MACHINE
===================================== */

function searchMachine() {
  const filter = document.getElementById("searchInput").value.toUpperCase();
  const rows   = document.getElementById("machineTable").getElementsByTagName("tr");

  for (let i = 1; i < rows.length; i++) {
    rows[i].style.display =
      rows[i].textContent.toUpperCase().indexOf(filter) > -1 ? "" : "none";
  }
}

/* =====================================
   BLOCK FILTER
===================================== */

function filterBlock() {
  const filter = document.getElementById("blockFilter").value;
  const rows   = document.getElementById("machineTable").getElementsByTagName("tr");

  for (let i = 1; i < rows.length; i++) {
    const block = rows[i].cells[2].innerHTML;
    rows[i].style.display = (filter === "all" || block === filter) ? "" : "none";
  }
}

/* =====================================
   MAINTENANCE LOGS — RENDER
===================================== */

function loadLogs() {
  const table = document.getElementById("logTableBody");
  if (!table) return;

  table.innerHTML = "";

  logs.forEach(log => {
    const row = table.insertRow();
    row.innerHTML = `
      <td>${log.id}</td>
      <td>${log.machine}</td>
      <td>${log.date}</td>
      <td>${log.technician}</td>
      <td>${log.cost}</td>
      <td>${log.status}</td>
      <td>
        <button onclick="editLog(this)">Edit</button>
        <button onclick="deleteLog(this)">Delete</button>
      </td>
    `;
  });

  calculateCost();
}

/* =====================================
   ADD LOG
===================================== */

async function addLog() {
  const machine    = document.getElementById("logMachine").value.trim();
  const date       = document.getElementById("logDate").value;
  const technician = document.getElementById("logTechnician").value.trim();
  const cost       = document.getElementById("logCost").value;
  const status     = document.getElementById("logStatus").value;

  if (!machine || !date || !technician || !cost) {
    showToast("Fill all fields", "error");
    return;
  }

  try {
    const created = await apiPost("/logs", { machine, date, technician, cost, status });
    logs.push(created);

    loadLogs();
    updateDashboard();
    updateCharts();
    //addAudit("Maintenance Log Added : " + machine);
    showToast("Log added successfully");

    document.getElementById("logMachine").value    = "";
    document.getElementById("logDate").value       = "";
    document.getElementById("logTechnician").value = "";
    document.getElementById("logCost").value       = "";
  } catch (_) {}
}

/* =====================================
   CALCULATE TOTAL COST
===================================== */

function calculateCost() {
  const total = logs.reduce((sum, log) => sum + (parseFloat(log.cost) || 0), 0);
  const el    = document.getElementById("totalCost");
  if (el) el.innerHTML = total;
}

/* =====================================
   DELETE LOG
===================================== */

async function deleteLog(button) {
  const row = button.parentNode.parentNode;
  const id  = parseInt(row.cells[0].innerHTML);

  try {
    await apiDelete("/logs/" + id);
    logs = logs.filter(l => l.id !== id);

    loadLogs();
    updateDashboard();
    updateCharts();
    //addAudit("Maintenance Log Deleted");
    showToast("Log deleted", "error");
  } catch (_) {}
}

/* =====================================
   EDIT LOG
===================================== */

async function editLog(button) {
  const row = button.parentNode.parentNode;
  const id  = parseInt(row.cells[0].innerHTML);
  const log = logs.find(l => l.id === id);
  if (!log) return;

  const machine    = prompt("Machine",    log.machine);
  const technician = prompt("Technician", log.technician);
  const cost       = prompt("Cost",       log.cost);
  const status     = prompt("Status (Completed / Pending / In Progress)", log.status);

  const updated = {
    machine:    machine    || log.machine,
    technician: technician || log.technician,
    cost:       cost       || log.cost,
    status:     status     || log.status
  };

  try {
    const result = await apiPut("/logs/" + id, updated);
    Object.assign(log, result);

    loadLogs();
    updateDashboard();
    updateCharts();
    //addAudit("Maintenance Log Updated");
    showToast("Log updated");
  } catch (_) {}
}

/* =====================================
   FAULT TICKETS — RENDER
===================================== */

function loadTickets() {
  const table = document.getElementById("ticketTableBody");
  if (!table) return;

  table.innerHTML = "";

  tickets.forEach(ticket => {
    const row = table.insertRow();
    row.innerHTML = `
      <td>FT${ticket.id}</td>
      <td>${ticket.machine}</td>
      <td>${ticket.priority}</td>
      <td>${ticket.status}</td>
      <td>
        <button onclick="editTicket(this)">Edit</button>
        <button onclick="deleteTicket(this)">Delete</button>
      </td>
    `;
  });

  updateOpenTickets();
}

/* =====================================
   ADD TICKET
===================================== */

async function addTicket() {
  const machine  = document.getElementById("ticketMachine").value.trim();
  const priority = document.getElementById("ticketPriority").value;
  const status   = document.getElementById("ticketStatus").value;

  if (!machine) {
    showToast("Enter Machine Name", "error");
    return;
  }

  try {
    const created = await apiPost("/tickets", { machine, priority, status });
    tickets.push(created);

    loadTickets();
    updateDashboard();
    updateCharts();
    //addAudit("Ticket Created : " + machine);
    showToast("Ticket created");

    document.getElementById("ticketMachine").value = "";
  } catch (_) {}
}

/* =====================================
   UPDATE OPEN TICKET COUNT
===================================== */

function updateOpenTickets() {
  const count = tickets.filter(t => t.status === "Open").length;
  const el    = document.getElementById("openTickets");
  if (el) el.innerHTML = count;
}

/* =====================================
   DELETE TICKET
===================================== */

async function deleteTicket(button) {
  const row = button.parentNode.parentNode;
  const id  = parseInt(row.cells[0].innerHTML.replace("FT", ""));

  try {
    await apiDelete("/tickets/" + id);
    tickets = tickets.filter(t => t.id !== id);

    loadTickets();
    updateDashboard();
    updateCharts();
    //addAudit("Ticket Deleted");
    showToast("Ticket deleted", "error");
  } catch (_) {}
}

/* =====================================
   EDIT TICKET
===================================== */

async function editTicket(button) {
  const row    = button.parentNode.parentNode;
  const id     = parseInt(row.cells[0].innerHTML.replace("FT", ""));
  const ticket = tickets.find(t => t.id === id);
  if (!ticket) return;

  const machine  = prompt("Machine",  ticket.machine);
  const priority = prompt("Priority (Low / Medium / High / Critical)", ticket.priority);
  const status   = prompt("Status (Open / In Progress / Closed)", ticket.status);

  const updated = {
    machine:  machine  || ticket.machine,
    priority: priority || ticket.priority,
    status:   status   || ticket.status
  };

  try {
    const result = await apiPut("/tickets/" + id, updated);
    Object.assign(ticket, result);

    loadTickets();
    updateDashboard();
    updateCharts();
    //addAudit("Ticket Updated");
    showToast("Ticket updated");
  } catch (_) {}
}

/* =====================================
   SPARE PARTS — RENDER
===================================== */

function loadParts() {
  const table = document.getElementById("partsTableBody");
  if (!table) return;

  table.innerHTML = "";

  parts.forEach(part => {
    const isLow = parseInt(part.stock) <= parseInt(part.reorder);
    const row   = table.insertRow();
    row.className = isLow ? "low-stock" : "";
    row.innerHTML = `
      <td>P${part.id}</td>
      <td>${part.name}</td>
      <td>${part.stock}</td>
      <td>${part.reorder}</td>
      <td>${part.cost}</td>
      <td>${isLow ? "Low Stock" : "Available"}</td>
      <td>
        <button onclick="editPart(this)">Edit</button>
        <button onclick="deletePart(this)">Delete</button>
      </td>
    `;
  });

  updateLowStock();
}

/* =====================================
   ADD PART
===================================== */

async function addPart() {
  const name    = document.getElementById("partName").value.trim();
  const stock   = document.getElementById("partStock").value;
  const reorder = document.getElementById("partReorder").value;
  const cost    = document.getElementById("partCost").value;

  if (!name || stock === "" || reorder === "" || cost === "") {
    showToast("Fill all fields", "error");
    return;
  }

  try {
    const created = await apiPost("/parts", { name, stock, reorder, cost });
    parts.push(created);

    loadParts();
    updateDashboard();
    //addAudit("Part Added : " + name);
    showToast("Part added successfully");

    document.getElementById("partName").value    = "";
    document.getElementById("partStock").value   = "";
    document.getElementById("partReorder").value = "";
    document.getElementById("partCost").value    = "";
  } catch (_) {}
}

/* =====================================
   EDIT PART
===================================== */

async function editPart(button) {
  const row  = button.parentNode.parentNode;
  const id   = parseInt(row.cells[0].innerHTML.replace("P", ""));
  const part = parts.find(p => p.id === id);
  if (!part) return;

  const name    = prompt("Part Name",     part.name);
  const stock   = prompt("Stock",         part.stock);
  const reorder = prompt("Reorder Level", part.reorder);
  const cost    = prompt("Cost",          part.cost);

  const updated = {
    name:    name    || part.name,
    stock:   stock   || part.stock,
    reorder: reorder || part.reorder,
    cost:    cost    || part.cost
  };

  try {
    const result = await apiPut("/parts/" + id, updated);
    Object.assign(part, result);

    loadParts();
    updateDashboard();
    //addAudit("Part Updated");
    showToast("Part updated");
  } catch (_) {}
}

/* =====================================
   DELETE PART
===================================== */

async function deletePart(button) {
  const row = button.parentNode.parentNode;
  const id  = parseInt(row.cells[0].innerHTML.replace("P", ""));

  try {
    await apiDelete("/parts/" + id);
    parts = parts.filter(p => p.id !== id);

    loadParts();
    updateDashboard();
    //addAudit("Part Deleted");
    showToast("Part deleted", "error");
  } catch (_) {}
}

/* =====================================
   UPDATE LOW STOCK COUNT
===================================== */

function updateLowStock() {
  const count = parts.filter(p => parseInt(p.stock) <= parseInt(p.reorder)).length;
  const el    = document.getElementById("lowStockCount");
  if (el) el.innerHTML = count;
}

/* =====================================
   DASHBOARD — ALL CARDS
===================================== */

function updateDashboard() {
  const due     = machines.filter(m => m.status === "Due Maintenance").length;
  const overdue = machines.filter(m => m.status === "Overdue").length;
  const repair  = machines.filter(m => m.status === "Under Repair").length;

  const totalCost    = logs.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);
  const totalLogs    = logs.length;
  const openTickets  = tickets.filter(t => t.status === "Open").length;
  const lowStock     = parts.filter(p => parseInt(p.stock) <= parseInt(p.reorder)).length;

  const el = id => document.getElementById(id);

  // Status Dashboard
  if (el("totalMachines"))     el("totalMachines").innerHTML     = machines.length;
  if (el("dueMachines"))       el("dueMachines").innerHTML       = due;
  if (el("overdueMachines"))   el("overdueMachines").innerHTML   = overdue;
  if (el("repairMachines"))    el("repairMachines").innerHTML    = repair;
  if (el("openTicketsStatus")) el("openTicketsStatus").innerHTML = openTickets;
  if (el("lowStockStatus"))    el("lowStockStatus").innerHTML    = lowStock;
  if (el("statusTotalCost"))   el("statusTotalCost").innerHTML   = "₹" + totalCost;

  // Reports Section
  if (el("reportTotalCost"))   el("reportTotalCost").innerHTML   = "₹" + totalCost;
  if (el("reportTotalLogs"))   el("reportTotalLogs").innerHTML   = totalLogs;
  if (el("reportOpenTickets")) el("reportOpenTickets").innerHTML = openTickets;
  if (el("reportLowStock"))    el("reportLowStock").innerHTML    = lowStock;

  // Inline section totals
  if (el("openTickets"))       el("openTickets").innerHTML       = openTickets;
  if (el("lowStockCount"))     el("lowStockCount").innerHTML     = lowStock;
  if (el("totalCost"))         el("totalCost").innerHTML         = totalCost;
}

/* =====================================
   AUDIT LOG — RENDER
===================================== */

// function loadAuditLog() {
//   const table = document.getElementById("auditTableBody");
//   if (!table) return;

//   table.innerHTML = "";

//   [...auditLogs].reverse().forEach(entry => {
//     const row = table.insertRow();
//     row.innerHTML = `
//       <td>${entry.id}</td>
//       <td>${entry.action}</td>
//       <td>${entry.timestamp}</td>
//     `;
//   });
// }

async function loadAuditLog() {
  try {
    const res  = await fetch(`${API_BASE}/audit`);
    const logs = await res.json();

    const table = document.getElementById("auditTableBody");
    if (!table) return;
    table.innerHTML = "";

    logs.forEach(entry => {
      let row = table.insertRow();
      row.innerHTML = `
        <td>${entry.id}</td>
        <td>${entry.action}</td>
        <td>${entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN') : "N/A"}</td>
      `;
    });

  } catch (err) {
    showToast("Failed to load audit log", "error");
  }
}
/* =====================================
   ADD AUDIT ENTRY
===================================== */

// async function //addAudit(action) {
//   try {
//     const entry = await apiPost("/audit", { action });
//     auditLogs.push(entry);
//     loadAuditLog();
//   } catch (_) {
//     // Audit failures are non-critical — log to console only
//     console.warn("Audit log failed for action:", action);
//   }
// }

// async function //addAudit(action) {
//   try {
//     await fetch(`${API_BASE}/audit`, {
//       method:  "POST",
//       headers: { "Content-Type": "application/json" },
//       body:    JSON.stringify({ action })
//     });
//     loadAuditLog();
//   } catch (_) {
//     console.warn("Audit log failed for action:", action);
//   }
// }
/* =====================================
   TOAST NOTIFICATIONS
===================================== */

function showToast(msg, type = "success") {
  const toast = document.createElement("div");

  toast.style.cssText = `
    position: fixed;
    bottom: 25px;
    right: 25px;
    background: ${type === "error" ? "#b91c1c" : "#166534"};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-family: Arial, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 9999;
    opacity: 1;
    transition: opacity 0.5s ease;
  `;

  toast.innerText = msg;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 2500);
}

/* =====================================
   CSV EXPORT — CORE HELPER
===================================== */

function downloadCSV(filename, headers, rows) {
  let csvContent = headers.join(",") + "\n";

  rows.forEach(row => {
    const line = row.map(cell => {
      const val = String(cell).replace(/"/g, '""');
      return `"${val}"`;
    }).join(",");
    csvContent += line + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");

  a.href     = url;
  a.download = filename;
  a.style.display = "none";

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Exported : " + filename);
  //addAudit("CSV Exported : " + filename);
}

/* =====================================
   EXPORT — MACHINE REGISTRY
===================================== */

function exportMachines() {
  if (machines.length === 0) { showToast("No machines to export", "error"); return; }
  downloadCSV(
    "machines.csv",
    ["ID", "Machine Code", "Block", "Machine Name", "Status"],
    machines.map(m => [m.id, m.code, m.block, m.machine, m.status])
  );
}

/* =====================================
   EXPORT — MAINTENANCE LOGS
===================================== */

function exportLogs() {
  if (logs.length === 0) { showToast("No logs to export", "error"); return; }
  downloadCSV(
    "maintenance_logs.csv",
    ["ID", "Machine", "Date", "Technician", "Cost (Rs)", "Status"],
    logs.map(l => [l.id, l.machine, l.date, l.technician, l.cost, l.status])
  );
}

/* =====================================
   EXPORT — FAULT TICKETS
===================================== */

function exportTickets() {
  if (tickets.length === 0) { showToast("No tickets to export", "error"); return; }
  downloadCSV(
    "fault_tickets.csv",
    ["Ticket ID", "Machine", "Priority", "Status"],
    tickets.map(t => ["FT" + t.id, t.machine, t.priority, t.status])
  );
}

/* =====================================
   EXPORT — SPARE PARTS
===================================== */

function exportParts() {
  if (parts.length === 0) { showToast("No parts to export", "error"); return; }
  downloadCSV(
    "spare_parts.csv",
    ["ID", "Part Name", "Stock", "Reorder Level", "Cost (Rs)", "Status"],
    parts.map(p => [
      "P" + p.id, p.name, p.stock, p.reorder, p.cost,
      parseInt(p.stock) <= parseInt(p.reorder) ? "Low Stock" : "Available"
    ])
  );
}

/* =====================================
   CLEAR ALL DATA
   Calls DELETE on every resource endpoint,
   then reloads the page.
===================================== */

async function clearAllData() {
  if (!confirm("Are you sure you want to clear ALL data? This cannot be undone.")) return;

  try {
    await Promise.all([
      apiDelete("/machines"),
      apiDelete("/logs"),
      apiDelete("/tickets"),
      apiDelete("/parts"),
      apiDelete("/audit")
    ]);
    showToast("All data cleared");
    location.reload();
  } catch (_) {}
}

/* =====================================
   CLEAR AUDIT LOG
===================================== */

// async function clearAuditLog() {
//   if (!confirm("Delete all audit records?")) return;

//   try {
//     await apiDelete("/audit");
//     auditLogs = [];
//     const table = document.getElementById("auditTableBody");
//     if (table) table.innerHTML = "";
//     showToast("Audit log cleared");
//   } catch (_) {}
// }

async function clearAuditLog() {
  if (!confirm("Delete all audit records?")) return;

  try {
    await fetch(`${API_BASE}/audit/clear`, { method: "DELETE" });
    const table = document.getElementById("auditTableBody");
    if (table) table.innerHTML = "";
    showToast("Audit log cleared");
  } catch (err) {
    showToast("Failed to clear audit log", "error");
  }
}

/* =====================================
   PAGE LOAD
   Fetch all data from the API in parallel,
   then populate the UI exactly as before.
===================================== */

window.onload = async function () {
  try {
    // Fetch all resources in parallel for fast page load
    const [
      machinesData,
      logsData,
      ticketsData,
      partsData,
      auditData
    ] = await Promise.all([
      apiGet("/machines"),
      apiGet("/logs"),
      apiGet("/tickets"),
      apiGet("/parts"),
      apiGet("/audit")
    ]);

    machines  = machinesData  || [];
    logs      = logsData      || [];
    tickets   = ticketsData   || [];
    parts     = partsData     || [];
    auditLogs = auditData     || [];

  } catch (e) {
    // If the API is unreachable, fall back to empty state
    // so the UI still renders without crashing
    console.error("Failed to load data from API:", e);
    machines = logs = tickets = parts = auditLogs = [];
  }

  loadMachines();
  loadLogs();
  loadTickets();
  loadParts();
  loadAuditLog();
  updateDashboard();
  updateCharts();
};