
// =======================================================
//  UNIVERSAL ADMIN POPUP (Arabic)
// =======================================================
function showAdminPopup(message, title = "تنبيه") {
  const textEl = document.getElementById("adminPopupText");
  const titleEl = document.getElementById("adminPopupTitle");
  const modalEl = document.getElementById("adminPopup");

  if (textEl) textEl.textContent = message;
  if (titleEl) titleEl.textContent = title;

  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } else {
    alert(message);
  }
}


// =======================================================
//   1) DASHBOARD (Attendance Update)
// =======================================================
function setupAttendance() {
  document.getElementById("attendanceForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const userName = document.getElementById("attendanceUser").value;
    const res = await fetch(`${API}/appointments/all`);
    const json = await res.json();
    const container = document.getElementById("attendanceList");

    const userApps = json.appointments.filter(
      (a) => a.userName === userName && a.status === "booked"
    );

    container.innerHTML = "";
    if (userApps.length === 0) {
      container.innerHTML = "<p>No booked appointments found for this user.</p>";
      return;
    }

    userApps.forEach((a) => {
      const d = new Date(a.date);

      const time = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const monthDay = d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric"
      });

      const weekday = d.toLocaleDateString("en-US", {
        weekday: "long"
      });

      const finalDate = `${monthDay} • ${weekday}`;

      container.innerHTML += `
  <div class="attendance-card">
    <div class="attendance-left">
      <p class="attendance-doctor">${a.doctorName}</p>
      <p class="attendance-date">${new Date(a.date).toLocaleString()}</p>
    </div>

    <div class="attendance-actions">
      <button class="btn btn-success btn-sm" onclick="markStatus('${a._id}','attended')">Attended</button>
      <button class="btn btn-danger btn-sm" onclick="markStatus('${a._id}','missed')">Missed</button>
    </div>
  </div>
`;

    });

  });
}


// =======================================================
//   2) AVAILABLE SLOTS (Add & Display)
// =======================================================
async function loadAvailableSlots() {
  const res = await fetch(`${API}/appointments/available`);
  const data = await res.json();
  const tbody = document.querySelector("#availableTable tbody");
  const select = document.getElementById("doctorFilter");

  // Doctor dropdown
  const doctors = [...new Set(data.slots.map((s) => s.doctorName))];
  select.innerHTML = `<option value="">All Doctors</option>` +
    doctors.map(d => `<option>${d}</option>`).join("");

  // Renderer
  const render = (slots) => {
    tbody.innerHTML = slots.length
      ? slots.map(s => `
        <tr>
          <td>${s.doctorName}</td>
          <td>${new Date(s.date).toLocaleDateString()}</td>
          <td>${new Date(s.date).toLocaleTimeString()}</td>
          <td>${s.status}</td>
          <td>
            <button class="btn btn-danger btn-sm"
                    onclick="deleteSlot('${s._id}')">
              Delete
            </button>
          </td>
        </tr>
      `).join("")
      : "<tr><td colspan='5' class='text-center text-muted'>No available slots</td></tr>";
  };

  render(data.slots);

  // Filter by doctor
  select.addEventListener("change", () => {
    const val = select.value;
    render(val ? data.slots.filter(s => s.doctorName === val) : data.slots);
  });

  // Add Appointment Block
  const addForm = document.getElementById("addForm");
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = addForm.querySelector("button[type=submit]");
    submitBtn.disabled = true; //  prevent double submit

    const doctorName = document.getElementById("doctorName").value.trim();
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value || null;
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value || null;
    const intervalMinutes = parseInt(document.getElementById("intervalMinutes").value) || 60;

    if (!doctorName || !startDate || !startTime) {
      showAdminPopup("الرجاء إدخال اسم الطبيب، وتاريخ البداية، ووقت البداية.", "حقول ناقصة");
      submitBtn.disabled = false;
      return;
    }

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime ? endTime.split(":").map(Number) : [undefined, undefined];

    try {
      const res = await fetch(`${API}/appointments/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorName,
          startDate,
          endDate,
          startHour,
          startMinute,
          endHour,
          endMinute,
          intervalMinutes
        }),
      });

      const response = await res.json();

      if (!res.ok) {
        showAdminPopup(response.error || "حدث خطأ أثناء إضافة المواعيد.", "خطأ");
        submitBtn.disabled = false;
        return;
      }

      showAdminPopup(response.message || "تمت إضافة المواعيد بنجاح.", "تمت الإضافة");

      const modal = bootstrap.Modal.getInstance(document.getElementById("addModal"));
      modal.hide();

      await loadAvailableSlots();

    } catch (err) {
      console.error("Error adding block:", err);
      showAdminPopup("حدث خطأ أثناء إضافة المواعيد، الرجاء المحاولة مرة أخرى.", "خطأ");
    }

    submitBtn.disabled = false; // 🔥 Reset here (correct place)
  });
}

window.deleteSlot = async function (id) {
  if (!confirm("Are you sure you want to delete this appointment slot?")) return;

  try {
    const res = await fetch(`${API}/appointments/delete/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (!res.ok) {
      return showAdminPopup(data.error || "Failed to delete slot.", "Error");
    }

    showAdminPopup("Appointment slot deleted successfully.", "Deleted");

    // reload table
    loadAvailableSlots();

  } catch (err) {
    console.error("Delete error:", err);
    showAdminPopup("Server error. Could not delete appointment slot.", "Error");
  }
};

// =======================================================
//   3) BOOKED PAGE (UPGRADED TO CARD VIEW)
// =======================================================
async function loadBooked() {
  const container = document.getElementById("bookedList"); // <div id="bookedList">
  container.innerHTML = "Loading...";

  const res = await fetch(`${API}/appointments/booked`);
  const json = await res.json();

  if (!json.appointments || json.appointments.length === 0) {
    container.innerHTML = `<p class="text-muted">No booked appointments found.</p>`;
    return;
  }

  container.innerHTML = json.appointments
    .map((a, index) => {
      const d = new Date(a.date);

      const time = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const monthDay = d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric"
      });

      const weekday = d.toLocaleDateString("en-US", {
        weekday: "long"
      });

      const finalDate = `${monthDay} - ${weekday}`;

      const reminderID = `rem-${index}`;

      const remindersHTML =
        a.reminders && a.reminders.length
          ? a.reminders
            .map(
              r => `
          <div class="reminder-item">
            <span class="badge bg-info text-dark">${r.messageType}</span>
            <span class="badge bg-${r.status === "sent" ? "success" : "warning"}">${r.status}</span>
            <small class="d-block mt-1">${new Date(r.sendTime).toLocaleString()}</small>
          </div>
        `
            )
            .join("")
          : `<small class="text-muted">No reminders</small>`;

      return `
      <div class="text-center card small-card shadow-sm">
        <div class="card-content">
          <p><b>${a.doctorName}</b></p>
          <p><small>User: ${a.userName || "-"}</small></p>
          <p><small>${time}</small></p>
          <p><small>${finalDate}</small></p>
        </div>

        <span class="status booked mb-2">booked</span>

        <button class="btn btn-sm btn-outline-secondary mt-2"
                data-bs-toggle="collapse"
                data-bs-target="#${reminderID}">
          View Reminders
        </button>

        <div class="collapse mt-2" id="${reminderID}">
          ${remindersHTML}
        </div>
      </div>
    `;
    })
    .join("");
}


function to12Hour(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:00 ${suffix}`;
}
// =======================================================
//   4) BASELINE PAGE (High-Demand)
// =======================================================
async function loadDoctorsForBaseline() {
  const doctorList = document.getElementById("doctorList");
  doctorList.innerHTML = "Loading doctors...";

  try {
    const res = await fetch(`${API}/appointments/all`);
    const data = await res.json();

    const doctors = [...new Set(data.appointments.map(a => a.doctorName))];

    if (doctors.length === 0) {
      doctorList.innerHTML = "<p>No doctors found.</p>";
      return;
    }

    doctorList.innerHTML = doctors.map(doc => `
      <div class="col-md-4">
        <div class="card p-3 text-center shadow-sm" onclick="viewDoctorMonths('${doc}')">
          <h5>${doc}</h5>
          <p class="text-muted">Click to view monthly baselines</p>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error("Error loading doctors:", err);
    doctorList.innerHTML = `<p class="text-danger">Failed to load doctors.</p>`;
  }
}

window.viewDoctorMonths = async function (doctorName) {
  const year = new Date().getFullYear();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const monthView = document.getElementById("monthView");
  monthView.innerHTML = `<h4 class="mt-4 mb-3">${doctorName}</h4>`;

  monthView.innerHTML += `
    <div class="row">
      ${months.map((m, i) => `
        <div class="col-md-4 mb-3">
          <div class="card p-3 shadow-sm" id="month-${i + 1}">
            <h6>${m} ${year}</h6>
            <div class="content text-muted small">Loading...</div>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  for (let i = 1; i <= 12; i++) {
    const box = document.querySelector(`#month-${i} .content`);
    try {
      const res = await fetch(`${API}/high-demand?doctorName=${doctorName}&year=${year}&month=${i}`);

      if (!res.ok) {
        box.innerHTML = `
          <p>No baseline data.</p>
          <button class="btn btn-sm btn-primary mt-2" onclick="openBaselineModal('${doctorName}', ${year}, ${i})">Add Baseline</button>`;
        continue;
      }

      const info = await res.json();

      if (info.rows.length === 0) {
        box.innerHTML = `
          <p>No baseline data.</p>
          <button class="btn btn-sm btn-primary mt-2" onclick="openBaselineModal('${doctorName}', ${year}, ${i})">Add Baseline</button>`;
      } else {

        const badges = info.rows
          .map(r => `<span class="badge bg-primary me-1">${to12Hour(r.hour)}</span>`)
          .join("");

        box.innerHTML = `
          <p><b>Baseline Hours:</b> ${badges}</p>
          <p><b>Total Slots:</b> ${info.summary.totalSlots}</p>
          <button class="btn btn-sm btn-outline-primary mt-2"
            onclick="openBaselineModal('${doctorName}', ${year}, ${i})">Edit Baseline</button>
        `;
      }

    } catch (err) {
      box.innerHTML = `<p class="text-danger">Error loading data.</p>`;
    }
  }
};


window.openBaselineModal = (doctorName, year, month) => {
  document.getElementById("doctorName").value = doctorName;
  document.getElementById("year").value = year;
  document.getElementById("month").value = month;

  document.getElementById("modalTitle").innerText =
    `تحديد ساعات الذروة للطبيب ${doctorName} (الشهر ${month} / ${year})`;

  new bootstrap.Modal(document.getElementById("baselineModal")).show();

  document.getElementById("baselineForm").onsubmit = async (e) => {
    e.preventDefault();
    const hoursText = document.getElementById("hours").value;
    const hours = hoursText.split(",").map(h => parseInt(h.trim())).filter(h => !isNaN(h));

    try {
      const res = await fetch(`${API}/high-demand/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorName, year, month, hours }),
      });

      const msg = await res.json();
      showAdminPopup(msg.message || "تم حفظ ساعات الذروة بنجاح.", "تم الحفظ");

      viewDoctorMonths(doctorName);
    } catch (err) {
      showAdminPopup("حدث خطأ أثناء حفظ البيانات.", "خطأ");
    }
  };
};


// =======================================================
//   5) UPDATE STATUS (attended/missed)
// =======================================================
async function markStatus(id, status) {
  try {
    const res = await fetch(`${API}/appointments/status/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const data = await res.json();

    let msg = data.message;
    if (status === "attended") msg = "تم تسجيل حضور الموعد.";
    else if (status === "missed") msg = "تم تسجيل الغياب.";

    showAdminPopup(msg, "تم التحديث");

  } catch (err) {
    showAdminPopup("حدث خطأ أثناء تحديث الحالة.", "خطأ");
  }
}


// =======================================================
//   6) PERFORMANCE PAGE
// =======================================================

let allUsers = [];

async function loadPerformanceStats() {
  try {
    const appts = await fetch(`${API}/appointments/all`).then(r => r.json());
    const users = await fetch(`${API}/users`).then(r => r.json());

    const available = appts.appointments.filter(a => a.status === "available").length;
    const booked = appts.appointments.filter(a => a.status === "booked").length;

    const veryGood = users.filter(u => u.category === "Very Good").length;
    const good = users.filter(u => u.category === "Good").length;
    const atRisk = users.filter(u => u.category === "At-Risk").length;

    document.getElementById("availableCount").textContent = available;
    document.getElementById("bookedCount").textContent = booked;
    document.getElementById("userCount").textContent = users.length;

    document.getElementById("vgCount").textContent = `${veryGood} Very Good`;
    document.getElementById("gCount").textContent = `${good} Good`;
    document.getElementById("arCount").textContent = `${atRisk} At-Risk`;

  } catch (err) {
    console.error("Stats error:", err);
  }
}

async function loadAllUsers() {
  try {
    let users = await fetch(`${API}/users`).then(r => r.json());

    const rank = { "Very Good": 1, "Good": 2, "At-Risk": 3 };
    users.sort((a, b) => rank[a.category] - rank[b.category]);

    allUsers = users;
    renderUsersTable(users);

  } catch (err) {
    console.error("Error loading users", err);
  }

  document.getElementById("userSearch").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    renderUsersTable(allUsers.filter(u => u.userName.toLowerCase().includes(q)));
  });

  document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.dataset.filter;
      filterUsers(cat);
    });
  });
}

function filterUsers(cat) {
  if (cat === "all") return renderUsersTable(allUsers);
  renderUsersTable(allUsers.filter(u => u.category === cat));
}

function renderUsersTable(list) {
  const tbody = document.getElementById("usersTable");

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(u => {
      const color =
        u.category === "Very Good" ? "success" :
          u.category === "Good" ? "primary" : "danger";

      return `
        <tr>
          <td>${u.userName}</td>
          <td>${u.phone || "-"}</td>

          <td>
            ${u.attendedCount} attended — ${u.missedCount} missed<br>
            <small class="text-muted">Rate: ${u.attendanceRate?.toFixed(2) || 0}%</small><br>
            <small class="text-info">Loyalty Points: ${u.score ?? 0}</small>
          </td>

          <td>
            <span class="badge bg-${color}" style="cursor:pointer"
              onclick="openCategoryModal('${u.userName}', '${u.category}')">
              ${u.category}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

let currentUser = null;

window.openCategoryModal = function (userName, currentCat) {
  currentUser = userName;
  document.getElementById("catUser").textContent =
    `User: ${userName} (Current: ${currentCat})`;
  document.getElementById("newCategory").value = currentCat;

  new bootstrap.Modal(document.getElementById("categoryModal")).show();
};

window.saveCategory = async function () {
  const newCat = document.getElementById("newCategory").value;

  try {
    const res = await fetch(`${API}/admin/set-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: currentUser, category: newCat })
    });

    // Close modal immediately so popup can show
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("categoryModal")
    );
    if (modal) modal.hide();

    showAdminPopup(
      `تم تحديث فئة المستخدم (${currentUser}) إلى: ${newCat}`,
      "تم التحديث"
    );

    setTimeout(() => location.reload(), 1500);

  } catch (err) {
    showAdminPopup("فشل تحديث الفئة، الرجاء المحاولة مرة أخرى.", "خطأ");
  }
};


// =======================================================
//   7) SINGLE DOMContentLoaded (Fixes All Page Loading)
// =======================================================

document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  if (path.includes("dashboard")) setupAttendance();
  else if (path.includes("add-block")) loadAvailableSlots();
  else if (path.includes("booked")) loadBooked();
  else if (path.includes("baseline")) loadDoctorsForBaseline();
  else if (path.includes("performance")) {
    loadPerformanceStats();
    loadAllUsers();
  }
});


