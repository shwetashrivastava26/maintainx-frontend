/* =====================================
   API BASE URL
===================================== */

const API_BASE = "https://maintainx-production.up.railway.app/api";

/* =====================================
   DEFAULT MACHINES — seeded on first load
===================================== */

const defaultMachines = [
  { code:"TS001", block:"Turbine Shop",                     machine:"Vertical Lathe",                          status:"Active" },
  { code:"TS002", block:"Turbine Shop",                     machine:"Horizontal Boring Machine",               status:"Active" },
  { code:"TS003", block:"Turbine Shop",                     machine:"CNC Milling Machine",                     status:"Active" },
  { code:"TS004", block:"Turbine Shop",                     machine:"Dynamic Balancing Machine",               status:"Active" },
  { code:"GM001", block:"Generator Manufacturing",          machine:"Radial Drilling Machine",                 status:"Active" },
  { code:"GM002", block:"Generator Manufacturing",          machine:"Hydraulic Press",                         status:"Active" },
  { code:"GM003", block:"Generator Manufacturing",          machine:"Balancing Machine",                       status:"Active" },
  { code:"GM004", block:"Generator Manufacturing",          machine:"VPI System",                              status:"Active" },
  { code:"TD001", block:"Transformer Division",             machine:"Core Cutting Machine",                    status:"Active" },
  { code:"TD002", block:"Transformer Division",             machine:"Horizontal Winding Machine",              status:"Active" },
  { code:"TD003", block:"Transformer Division",             machine:"Hydraulic Clamping System",               status:"Active" },
  { code:"TD004", block:"Transformer Division",             machine:"AC Pressurized Horizontal Welding Machine", status:"Active" },
  { code:"TD005", block:"Transformer Division",             machine:"HV Test Equipment",                       status:"Active" },
  { code:"SR001", block:"Switchgear and Rectifier",         machine:"Busbar Processing Machine",               status:"Active" },
  { code:"SR002", block:"Switchgear and Rectifier",         machine:"Relay Test Bench",                        status:"Active" },
  { code:"SR003", block:"Switchgear and Rectifier",         machine:"Main Rectifier Assembly",                 status:"Active" },
  { code:"FS001", block:"Fabrication Shop",                 machine:"Shearing Machine",                        status:"Active" },
  { code:"FS002", block:"Fabrication Shop",                 machine:"Press Brake Machine",                     status:"Active" },
  { code:"FS003", block:"Fabrication Shop",                 machine:"MIG Welding Machine",                     status:"Active" },
  { code:"MS001", block:"Machine Shop",                     machine:"CNC Lathe",                               status:"Active" },
  { code:"MS002", block:"Machine Shop",                     machine:"Milling Machine",                         status:"Active" },
  { code:"MS003", block:"Machine Shop",                     machine:"Surface Grinder",                         status:"Active" },
  { code:"TF001", block:"Testing and Auxiliary Facilities", machine:"Impulse Generator",                       status:"Active" },
  { code:"TF002", block:"Testing and Auxiliary Facilities", machine:"100 kV AC HV Tester",                    status:"Active" },
  { code:"TF003", block:"Testing and Auxiliary Facilities", machine:"Measuring Instruments",                   status:"Active" }
];

/* =====================================
   CHART INSTANCES
===================================== */

let machineStatusChart  = null;
let costByMonthChart    = null;
let ticketPriorityChart = null;

/* =====================================
   SEED DEFAULT MACHINES
===================================== */

async function seedDefaultMachines() {
  try {
    const res      = await fetch(`${API_BASE}/machines`);
    const existing = await res.json();
    if (existing.length > 0) return;

    for (const m of defaultMachines) {
      await fetch(`${API_BASE}/machines`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(m)
      });
    }
    showToast("Default machines loaded");
  } catch (err) {
    console.error("Seeding failed", err);
  }
}

/* =====================================
   REFRESH ALL SECTIONS
===================================== */

async function refreshAll() {
  await Promise.all([
    loadMachines(),
    loadLogs(),
    loadTickets(),
    loadParts(),
    loadAuditLog()
  ]);
  await updateDashboard();
  await updateCharts();
}

/* =====================================
   MACHINE REGISTRY — LOAD
===================================== */

async function loadMachines() {
  try {
    const res      = await fetch(`${API_BASE}/machines`);
    const machines = await res.json();

    const table = document.getElementById("machineTableBody");
    if (!table) return;
    table.innerHTML = "";

    machines.forEach(machine => {
      let row = table.insertRow();
      row.innerHTML = `
        <td>${machine.id}</td>
        <td>${machine.code}</td>
        <td>${machine.block}</td>
        <td>${machine.machine}</td>
        <td class="${
          machine.status === 'Active'          ? 'status-active'  :
          machine.status === 'Due Maintenance' ? 'status-due'     :
          machine.status === 'Overdue'         ? 'status-overdue' :
          'status-repair'
        }">${machine.status}</td>
        <td>
          <button onclick="generateQR('${machine.code}')">QR</button>
          <button onclick="editRow(${machine.id})">Edit</button>
          <button onclick="deleteRow(${machine.id})">Delete</button>

        </td>
      `;
    });

  } catch (err) {
    showToast("Failed to load machines", "error");
  }
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
    const res = await fetch(`${API_BASE}/machines`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code, block, machine, status })
    });

    if (res.ok) {
      showToast("Machine added successfully");
      document.getElementById("machineCode").value = "";
      document.getElementById("block").value       = "";
      document.getElementById("machineName").value = "";
      await refreshAll();
    } else {
      showToast("Failed to add machine", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   DELETE MACHINE
===================================== */

async function deleteRow(id) {
  if (!confirm("Delete this machine?")) return;

  try {
    const res = await fetch(`${API_BASE}/machines/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Machine deleted", "error");
      await refreshAll();
    } else {
      showToast("Failed to delete machine", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   EDIT MACHINE
===================================== */

async function editRow(id) {
  try {
    const res     = await fetch(`${API_BASE}/machines/${id}`);
    const machine = await res.json();

    const code   = prompt("Machine Code", machine.code);
    const block  = prompt("Block", machine.block);
    const name   = prompt("Machine Name", machine.machine);
    const status = prompt("Status (Active / Due Maintenance / Overdue / Under Repair)", machine.status);

    if (!code && !block && !name && !status) return;

    const updated = {
      code:    code    || machine.code,
      block:   block   || machine.block,
      machine: name    || machine.machine,
      status:  status  || machine.status
    };

    const updateRes = await fetch(`${API_BASE}/machines/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(updated)
    });

    if (updateRes.ok) {
      showToast("Machine updated");
      await refreshAll();
    } else {
      showToast("Failed to update machine", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
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
   MAINTENANCE LOGS — LOAD
===================================== */

async function loadLogs() {
  try {
    const res  = await fetch(`${API_BASE}/logs`);
    const logs = await res.json();

    const table = document.getElementById("logTableBody");
    if (!table) return;
    table.innerHTML = "";

    let total = 0;

    logs.forEach(log => {
      total += parseFloat(log.cost) || 0;
      let row = table.insertRow();
      row.innerHTML = `
        <td>${log.id}</td>
        <td>${log.machine}</td>
        <td>${log.date}</td>
        <td>${log.technician}</td>
        <td>${log.cost}</td>
        <td>${log.status}</td>
        <td>
          <button onclick="editLog(${log.id})">Edit</button>
          <button onclick="deleteLog(${log.id})">Delete</button>
        </td>
      `;
    });

    const totalEl = document.getElementById("totalCost");
    if (totalEl) totalEl.innerHTML = total.toFixed(2);

  } catch (err) {
    showToast("Failed to load logs", "error");
  }
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
    const res = await fetch(`${API_BASE}/logs`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ machine, date, technician, cost: parseFloat(cost), status })
    });

    if (res.ok) {
      showToast("Log added successfully");
      document.getElementById("logMachine").value    = "";
      document.getElementById("logDate").value       = "";
      document.getElementById("logTechnician").value = "";
      document.getElementById("logCost").value       = "";
      await refreshAll();
    } else {
      showToast("Failed to add log", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   DELETE LOG
===================================== */

async function deleteLog(id) {
  if (!confirm("Delete this log?")) return;

  try {
    const res = await fetch(`${API_BASE}/logs/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Log deleted", "error");
      await refreshAll();
    } else {
      showToast("Failed to delete log", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   EDIT LOG
===================================== */

async function editLog(id) {
  try {
    const res = await fetch(`${API_BASE}/logs/${id}`);
    const log = await res.json();

    const machine    = prompt("Machine", log.machine);
    const technician = prompt("Technician", log.technician);
    const cost       = prompt("Cost", log.cost);
    const status     = prompt("Status (Completed / Pending / In Progress)", log.status);

    const updated = {
      machine:    machine    || log.machine,
      date:       log.date,
      technician: technician || log.technician,
      cost:       parseFloat(cost) || log.cost,
      status:     status     || log.status
    };

    const updateRes = await fetch(`${API_BASE}/logs/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(updated)
    });

    if (updateRes.ok) {
      showToast("Log updated");
      await refreshAll();
    } else {
      showToast("Failed to update log", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   FAULT TICKETS — LOAD
===================================== */

async function loadTickets() {
  try {
    const res     = await fetch(`${API_BASE}/tickets`);
    const tickets = await res.json();

    const table = document.getElementById("ticketTableBody");
    if (!table) return;
    table.innerHTML = "";

    let openCount = 0;

    tickets.forEach(ticket => {
      if (ticket.status === "Open") openCount++;
      let row = table.insertRow();
      row.innerHTML = `
        <td>FT${ticket.id}</td>
        <td>${ticket.machine}</td>
        <td>${ticket.priority}</td>
        <td>${ticket.status}</td>
        <td>
          <button onclick="editTicket(${ticket.id})">Edit</button>
          <button onclick="deleteTicket(${ticket.id})">Delete</button>
        </td>
      `;
    });

    const openEl = document.getElementById("openTickets");
    if (openEl) openEl.innerHTML = openCount;

  } catch (err) {
    showToast("Failed to load tickets", "error");
  }
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
    const res = await fetch(`${API_BASE}/tickets`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ machine, priority, status })
    });

    if (res.ok) {
      showToast("Ticket created");
      document.getElementById("ticketMachine").value = "";
      await refreshAll();
    } else {
      showToast("Failed to create ticket", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   DELETE TICKET
===================================== */

async function deleteTicket(id) {
  if (!confirm("Delete this ticket?")) return;

  try {
    const res = await fetch(`${API_BASE}/tickets/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Ticket deleted", "error");
      await refreshAll();
    } else {
      showToast("Failed to delete ticket", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   EDIT TICKET
===================================== */

async function editTicket(id) {
  try {
    const res    = await fetch(`${API_BASE}/tickets/${id}`);
    const ticket = await res.json();

    const machine  = prompt("Machine", ticket.machine);
    const priority = prompt("Priority (Low / Medium / High / Critical)", ticket.priority);
    const status   = prompt("Status (Open / In Progress / Closed)", ticket.status);

    const updated = {
      machine:  machine  || ticket.machine,
      priority: priority || ticket.priority,
      status:   status   || ticket.status
    };

    const updateRes = await fetch(`${API_BASE}/tickets/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(updated)
    });

    if (updateRes.ok) {
      showToast("Ticket updated");
      await refreshAll();
    } else {
      showToast("Failed to update ticket", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   SPARE PARTS — LOAD
===================================== */

async function loadParts() {
  try {
    const res   = await fetch(`${API_BASE}/parts`);
    const parts = await res.json();

    const table = document.getElementById("partsTableBody");
    if (!table) return;
    table.innerHTML = "";

    let lowCount = 0;

    parts.forEach(part => {
      const isLow = parseInt(part.stock) <= parseInt(part.reorder);
      if (isLow) lowCount++;
      let row = table.insertRow();
      row.className = isLow ? "low-stock" : "";
      row.innerHTML = `
        <td>P${part.id}</td>
        <td>${part.name}</td>
        <td>${part.stock}</td>
        <td>${part.reorder}</td>
        <td>${part.cost}</td>
        <td>${isLow ? "Low Stock" : "Available"}</td>
        <td>
          <button onclick="editPart(${part.id})">Edit</button>
          <button onclick="deletePart(${part.id})">Delete</button>
        </td>
      `;
    });

    const lowEl = document.getElementById("lowStockCount");
    if (lowEl) lowEl.innerHTML = lowCount;

  } catch (err) {
    showToast("Failed to load parts", "error");
  }
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
    const res = await fetch(`${API_BASE}/parts`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name,
        stock:   parseInt(stock),
        reorder: parseInt(reorder),
        cost:    parseFloat(cost)
      })
    });

    if (res.ok) {
      showToast("Part added successfully");
      document.getElementById("partName").value    = "";
      document.getElementById("partStock").value   = "";
      document.getElementById("partReorder").value = "";
      document.getElementById("partCost").value    = "";
      await refreshAll();
    } else {
      showToast("Failed to add part", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   EDIT PART
===================================== */

async function editPart(id) {
  try {
    const res  = await fetch(`${API_BASE}/parts/${id}`);
    const part = await res.json();

    const name    = prompt("Part Name", part.name);
    const stock   = prompt("Stock", part.stock);
    const reorder = prompt("Reorder Level", part.reorder);
    const cost    = prompt("Cost", part.cost);

    const updated = {
      name:    name    || part.name,
      stock:   parseInt(stock)   || part.stock,
      reorder: parseInt(reorder) || part.reorder,
      cost:    parseFloat(cost)  || part.cost
    };

    const updateRes = await fetch(`${API_BASE}/parts/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(updated)
    });

    if (updateRes.ok) {
      showToast("Part updated");
      await refreshAll();
    } else {
      showToast("Failed to update part", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   DELETE PART
===================================== */

async function deletePart(id) {
  if (!confirm("Delete this part?")) return;

  try {
    const res = await fetch(`${API_BASE}/parts/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Part deleted", "error");
      await refreshAll();
    } else {
      showToast("Failed to delete part", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =====================================
   AUDIT LOG — LOAD
===================================== */

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
        <td>${entry.timestamp ? new Date(entry.timestamp + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : "N/A"}</td>
      `;
    });

  } catch (err) {
    showToast("Failed to load audit log", "error");
  }
}

/* =====================================
   CLEAR AUDIT LOG
===================================== */

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
   DASHBOARD — UPDATE ALL CARDS
===================================== */

async function updateDashboard() {
  try {
    const [machinesRes, logsRes, ticketsRes, partsRes] = await Promise.all([
      fetch(`${API_BASE}/machines`),
      fetch(`${API_BASE}/logs`),
      fetch(`${API_BASE}/tickets`),
      fetch(`${API_BASE}/parts`)
    ]);

    const machines = await machinesRes.json();
    const logs     = await logsRes.json();
    const tickets  = await ticketsRes.json();
    const parts    = await partsRes.json();

    const due     = machines.filter(m => m.status === "Due Maintenance").length;
    const overdue = machines.filter(m => m.status === "Overdue").length;
    const repair  = machines.filter(m => m.status === "Under Repair").length;

    const totalCost   = logs.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);
    const totalLogs   = logs.length;
    const openTickets = tickets.filter(t => t.status === "Open").length;
    const lowStock    = parts.filter(p => parseInt(p.stock) <= parseInt(p.reorder)).length;

    const el = (id) => document.getElementById(id);

    if (el("totalMachines"))     el("totalMachines").innerHTML     = machines.length;
    if (el("dueMachines"))       el("dueMachines").innerHTML       = due;
    if (el("overdueMachines"))   el("overdueMachines").innerHTML   = overdue;
    if (el("repairMachines"))    el("repairMachines").innerHTML    = repair;
    if (el("openTicketsStatus")) el("openTicketsStatus").innerHTML = openTickets;
    if (el("lowStockStatus"))    el("lowStockStatus").innerHTML    = lowStock;
    if (el("statusTotalCost"))   el("statusTotalCost").innerHTML   = "₹" + totalCost.toFixed(2);

    if (el("reportTotalCost"))   el("reportTotalCost").innerHTML   = "₹" + totalCost.toFixed(2);
    if (el("reportTotalLogs"))   el("reportTotalLogs").innerHTML   = totalLogs;
    if (el("reportOpenTickets")) el("reportOpenTickets").innerHTML = openTickets;
    if (el("reportLowStock"))    el("reportLowStock").innerHTML    = lowStock;

    if (el("openTickets"))       el("openTickets").innerHTML       = openTickets;
    if (el("lowStockCount"))     el("lowStockCount").innerHTML     = lowStock;
    if (el("totalCost"))         el("totalCost").innerHTML         = totalCost.toFixed(2);

  } catch (err) {
    console.error("Dashboard update failed", err);
  }
}

/* =====================================
   CHARTS
===================================== */

async function updateCharts() {
  try {
    const [machinesRes, logsRes, ticketsRes] = await Promise.all([
      fetch(`${API_BASE}/machines`),
      fetch(`${API_BASE}/logs`),
      fetch(`${API_BASE}/tickets`)
    ]);

    const machines = await machinesRes.json();
    const logs     = await logsRes.json();
    const tickets  = await ticketsRes.json();

    drawMachineStatusChart(machines);
    drawCostByMonthChart(logs);
    drawTicketPriorityChart(tickets);

  } catch (err) {
    console.error("Chart update failed", err);
  }
}

function drawMachineStatusChart(machines) {
  const ctx = document.getElementById("machineStatusChart");
  if (!ctx) return;
  if (machineStatusChart) machineStatusChart.destroy();

  machineStatusChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Active", "Due Maintenance", "Overdue", "Under Repair"],
      datasets: [{
        data: [
          machines.filter(m => m.status === "Active").length,
          machines.filter(m => m.status === "Due Maintenance").length,
          machines.filter(m => m.status === "Overdue").length,
          machines.filter(m => m.status === "Under Repair").length
        ],
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

function drawCostByMonthChart(logs) {
  const ctx = document.getElementById("costByMonthChart");
  if (!ctx) return;
  if (costByMonthChart) costByMonthChart.destroy();

  let monthMap = {};
  logs.forEach(log => {
    if (!log.date) return;
    const d     = new Date(log.date);
    const label = d.toLocaleString("default", { month: "short", year: "numeric" });
    monthMap[label] = (monthMap[label] || 0) + (parseFloat(log.cost) || 0);
  });

  const sortedKeys = Object.keys(monthMap).sort((a, b) => new Date(a) - new Date(b));

  costByMonthChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sortedKeys.length ? sortedKeys : ["No Data"],
      datasets: [{
        label: "Maintenance Cost (₹)",
        data: sortedKeys.length ? sortedKeys.map(k => monthMap[k]) : [0],
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

function drawTicketPriorityChart(tickets) {
  const ctx = document.getElementById("ticketPriorityChart");
  if (!ctx) return;
  if (ticketPriorityChart) ticketPriorityChart.destroy();

  ticketPriorityChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Low", "Medium", "High", "Critical"],
      datasets: [{
        data: [
          tickets.filter(t => t.priority === "Low").length,
          tickets.filter(t => t.priority === "Medium").length,
          tickets.filter(t => t.priority === "High").length,
          tickets.filter(t => t.priority === "Critical").length
        ],
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
   CSV EXPORT
===================================== */

function downloadCSV(filename, headers, rows) {
  let csv = headers.join(",") + "\n";
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast("Exported: " + filename);
}

async function exportMachines() {
  const res      = await fetch(`${API_BASE}/machines`);
  const machines = await res.json();
  if (!machines.length) { showToast("No machines to export", "error"); return; }
  downloadCSV("machines.csv",
    ["ID", "Machine Code", "Block", "Machine Name", "Status"],
    machines.map(m => [m.id, m.code, m.block, m.machine, m.status])
  );
}

async function exportLogs() {
  const res  = await fetch(`${API_BASE}/logs`);
  const logs = await res.json();
  if (!logs.length) { showToast("No logs to export", "error"); return; }
  downloadCSV("maintenance_logs.csv",
    ["ID", "Machine", "Date", "Technician", "Cost (Rs)", "Status"],
    logs.map(l => [l.id, l.machine, l.date, l.technician, l.cost, l.status])
  );
}

async function exportTickets() {
  const res     = await fetch(`${API_BASE}/tickets`);
  const tickets = await res.json();
  if (!tickets.length) { showToast("No tickets to export", "error"); return; }
  downloadCSV("fault_tickets.csv",
    ["Ticket ID", "Machine", "Priority", "Status"],
    tickets.map(t => ["FT" + t.id, t.machine, t.priority, t.status])
  );
}

async function exportParts() {
  const res   = await fetch(`${API_BASE}/parts`);
  const parts = await res.json();
  if (!parts.length) { showToast("No parts to export", "error"); return; }
  downloadCSV("spare_parts.csv",
    ["ID", "Part Name", "Stock", "Reorder Level", "Cost (Rs)", "Status"],
    parts.map(p => [
      "P" + p.id, p.name, p.stock, p.reorder, p.cost,
      parseInt(p.stock) <= parseInt(p.reorder) ? "Low Stock" : "Available"
    ])
  );
}

/* =====================================
   TOAST NOTIFICATIONS
===================================== */

function showToast(msg, type = "success") {
  let toast = document.createElement("div");
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
   PAGE LOAD
===================================== */

window.onload = async function () {
  await seedDefaultMachines();
  await refreshAll();
};

function generateQR(machineCode) {
  const url = `${window.location.origin}/machine.html?code=${machineCode}`;

  const existing = document.getElementById("qrModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "qrModal";
  modal.style.cssText = `
    position: fixed; top:0; left:0; width:100%; height:100%;
    background: rgba(0,0,0,0.6); display:flex; align-items:center;
    justify-content:center; z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="background:#fff; padding:30px; border-radius:10px; text-align:center; font-family:Arial; max-width:320px;">
      <h2 style="margin-top:0;">${machineCode}</h2>
      <div id="qrCanvasBox"></div>
      <p style="font-size:12px; word-break:break-all;">${url}</p>
      <button onclick="printQR('${machineCode}')" style="margin:5px; padding:8px 16px;">Print</button>
      <button onclick="document.getElementById('qrModal').remove()" style="margin:5px; padding:8px 16px;">Close</button>
    </div>
  `;

  document.body.appendChild(modal);

  new QRCode(document.getElementById("qrCanvasBox"), {
    text: url,
    width: 220,
    height: 220
  });
}

function printQR(machineCode) {
  const img = document.querySelector("#qrCanvasBox img") || document.querySelector("#qrCanvasBox canvas");
  if (!img) return;

  const src = img.tagName === "CANVAS" ? img.toDataURL() : img.src;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head><title>QR - ${machineCode}</title></head>
      <body style="text-align:center; font-family:Arial; padding:40px;">
        <h2>${machineCode}</h2>
        <img src="${src}" />
        <script>window.onload = function(){ window.print(); }</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}