// ==============================
// user.js — Final Version (API-aware, scalable)
// ==============================

// Popup for user notifications
function showUserPopup(message, title = "تنبيه") {
  const textEl = document.getElementById("userPopupText");
  const titleEl = document.getElementById("userPopupTitle");
  const modalEl = document.getElementById("userPopup");

  if (textEl) textEl.textContent = message;
  if (titleEl) titleEl.textContent = title;

  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } else {
    alert(message);
  }
}



// ==============================
// 1️⃣ Available Page
// ==============================
function setupAvailablePage(API, userName, phone) {
  const box = document.getElementById("appointmentBox");

  // Telegram status check
  const tgStatus = document.getElementById("telegramStatus");
  if (tgStatus) {
    tgStatus.textContent = "Checking Telegram status...";

    fetch(`${API}/users/${userName}`)
      .then(res => res.json())
      .then(data => {
        if (data.telegramLinked) {
          tgStatus.textContent =
            "✅ Telegram connected – you will receive reminders.";
        } else {
          tgStatus.innerHTML = `
            ⚠️ Telegram NOT connected yet.<br>
            <a href="/connect-telegram?name=${encodeURIComponent(userName)}"
               class="btn btn-sm btn-warning mt-2">
              Connect Telegram
            </a>
          `;
        }
      })
      .catch(() => {
        tgStatus.textContent = "❌ Unable to check Telegram status.";
      });
  }

  // Load upcoming appointments
  async function loadAppointments() {
    box.innerHTML = "Loading...";
    try {
      const res = await fetch(`${API}/appointments/booked?ts=${Date.now()}`);
      const data = await res.json();

      const myApps = data.appointments
        .filter(a => a.userName === userName && a.status === "booked")
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (myApps.length === 0) {
        box.innerHTML = `<p>No upcoming appointments.</p>`;
        return;
      }

      box.innerHTML = myApps
        .map(app => {
          const d = new Date(app.date);

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

          return `
      <div class="card small-card">
        <div class="card-content">
          <p><b>${app.doctorName}</b></p>
          <p><small>${time}</small></p>
          <p><small>${finalDate}</small></p>
        </div>
        <span class="status booked">booked</span>
      </div>
    `;
        })
        .join("");

    } catch (err) {
      console.error("Error loading appointments:", err);
      box.innerHTML = `<p style="color:red;">Failed to load appointments.</p>`;
    }
  }

  loadAppointments();

  const bookBtn = document.getElementById("bookBtn");
  if (bookBtn) {
    bookBtn.onclick = () => {
      window.location.href = `/user/doctors?userName=${encodeURIComponent(
        userName
      )}&phone=${phone}`;
    };
  }
}



// ==============================
// 2️⃣ Doctors Page
// ==============================
function setupDoctorsPage(API, userName, phone) {
  const list = document.getElementById("doctorList");
  const search = document.getElementById("search");

  async function loadDoctors() {
    list.innerHTML = "Loading available doctors...";
    try {
      const res = await fetch(`${API}/appointments/available?ts=${Date.now()}`);
      const data = await res.json();

      const doctorsMap = new Map();
      data.slots.forEach(slot => {
        if (!doctorsMap.has(slot.doctorName)) {
          doctorsMap.set(slot.doctorName, {
            name: slot.doctorName,
            specialty: slot.specialty || "General Practitioner",
          });
        }
      });

      const doctors = Array.from(doctorsMap.values());
      render(doctors);

      search.addEventListener("input", e => {
        const q = e.target.value.toLowerCase();
        render(doctors.filter(d => d.name.toLowerCase().includes(q)));
      });

      function render(docs) {
        if (docs.length === 0) {
          list.innerHTML = `<p>No available doctors found.</p>`;
          return;
        }

        list.innerHTML = docs
          .map(
            d => `
             <div class="doctor-card" onclick="selectDoctor('${d.name}')">
  <h5>${d.name}</h5>
  <small class="text-muted">${d.specialty}</small>
</div>
            `
          )
          .join("");
      }

      window.selectDoctor = name => {
        window.location.href = `/user/times?doctor=${encodeURIComponent(
          name
        )}&userName=${userName}&phone=${phone}`;
      };
    } catch (err) {
      console.error("Error fetching doctors:", err);
      list.innerHTML = `<p class="text-danger">Failed to load doctors.</p>`;
    }
  }

  loadDoctors();
}



// ==============================
// 3️⃣ Times Page (Booking)
// ==============================
function setupTimesPage(API, doctor, userName, phone) {
  const slotsDiv = document.getElementById("slots");

  async function loadSlots() {
    slotsDiv.innerHTML = "Loading available times...";
    try {
      const res = await fetch(`${API}/appointments/available?ts=${Date.now()}`);
      const data = await res.json();

      const slots = data.slots.filter(s => s.doctorName === doctor);

      if (slots.length === 0) {
        slotsDiv.innerHTML = "<p>No available times right now.</p>";
        return;
      }

      slotsDiv.innerHTML = slots
        .map(s => {
          const d = new Date(s.date);

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

          return `
      <div class="time-card">
        <div class="time-content">
          <p class="time-hour">${time}</p>
          <p class="time-date">${finalDate}</p>
        </div>
        <button class="btn btn-primary btn-sm w-100 mt-2" onclick="bookSlot('${s._id}')">
          Book
        </button>
      </div>
    `;
        })
        .join("");
    } catch (err) {
      console.error("Error loading times:", err);
      slotsDiv.innerHTML = `<p class="text-danger">Failed to load times.</p>`;
    }
  }

  // BOOKING LOGIC
  window.bookSlot = async id => {
    try {
      // 1️⃣ Check Telegram link status
      let linked = false;
      try {
        const check = await fetch(`${API}/users/${encodeURIComponent(userName)}`);
        if (check.ok) {
          const userData = await check.json();
          linked = !!userData.telegramLinked;
        }
      } catch {
        linked = false;
      }

      if (!linked) {
        showUserPopup(
          "يبدو أنك لم تقم بربط حسابك مع تيليغرام بعد.\n\nمن فضلك افتح البوت واكتب اسم المستخدم الخاص بك لإتمام الربط.",
          "ربط تيليغرام مطلوب"
        );
        return (window.location.href = `/connect-telegram?name=${encodeURIComponent(
          userName
        )}`);
      }

      // 2️⃣ Book the appointment
      const res = await fetch(`${API}/appointments/book/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, phone }),
      });

      const msg = await res.json();

      // If API returns error (high demand / restricted / etc.)
      if (!res.ok) {
        showUserPopup(
          msg.message || "تعذّر حجز الموعد. الرجاء اختيار وقت آخر.",
          "تنبيه"
        );
        return;
      }

      // Success
      showUserPopup(
        msg.message || "تم حجز الموعد بنجاح ✅",
        "حجز الموعد"
      );

      setTimeout(() => {
        window.location.href = `/user/available?userName=${encodeURIComponent(
          userName
        )}&phone=${encodeURIComponent(phone)}`;
      }, 2500);
    } catch (err) {
      console.error("Booking failed:", err);
      showUserPopup("فشل حجز الموعد، الرجاء المحاولة مرة أخرى.", "خطأ");
    }
  };

  loadSlots();
}



// ==============================
// 4️⃣ Past Appointments
// ==============================
function setupPastPage(API, userName, phone) {
  const list = document.getElementById("pastList");

  const filterBar = document.createElement("div");
  filterBar.className = "d-flex justify-content-center gap-2 mb-3 flex-wrap";
  filterBar.innerHTML = `
    <button class="btn btn-outline-primary btn-sm " id="showAll">All</button>
    <button class="btn btn-outline-success btn-sm " id="showAttended">Attended</button>
    <button class="btn btn-outline-danger btn-sm" id="showMissed">Missed</button>
  `;
  list.parentNode.insertBefore(filterBar, list);

  let allAppointments = [];

  async function loadPast() {
    list.innerHTML = "Loading past appointments...";
    try {
      const res = await fetch(`${API}/appointments/all?ts=${Date.now()}`);
      const data = await res.json();

      allAppointments = data.appointments
        .filter(
          a =>
            a.userName === userName &&
            (a.status === "attended" || a.status === "missed")
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      render(allAppointments);
    } catch (err) {
      console.error("Error loading past appointments:", err);
      list.innerHTML =
        `<p class="text-danger">Failed to load past appointments.</p>`;
    }
  }

  function render(apps) {
    if (apps.length === 0) {
      list.innerHTML = "<p>No appointments found for this filter.</p>";
      return;
    }

    list.innerHTML = apps
      .map(app => {
        const d = new Date(app.date);

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

        const tagColor =
          app.status === "attended" ? "success"
            : app.status === "missed" ? "danger"
              : "secondary";

        return `
      <div class="past-card">
        <div class="past-left">
          <p class="past-doctor">${app.doctorName}</p>
          <p class="past-date">${finalDate}</p>
          <p class="past-time">${time}</p>
        </div>
        <span class="badge bg-${tagColor} past-badge">${app.status}</span>
      </div>
    `;
      })
      .join("");
  }

  document.addEventListener("click", e => {
    if (e.target.id === "showAll") render(allAppointments);
    if (e.target.id === "showAttended")
      render(allAppointments.filter(a => a.status === "attended"));
    if (e.target.id === "showMissed")
      render(allAppointments.filter(a => a.status === "missed"));
  });

  loadPast();
}



// ==============================
// 5️⃣ Loyalty Points Page
// ==============================
function setupLoyaltyPage(API, userName) {
  const info = document.getElementById("pointsInfo");
  info.innerHTML = "Loading...";

  async function loadPoints() {
    try {
      const res = await fetch(
        `${API}/users/${encodeURIComponent(userName)}`
      );
      const user = await res.json();

      info.innerHTML = `
  <h4>${user.score ?? 0} Points</h4>

  <div class="reward-card-list mt-3">

    <div class="reward-card">
      <div class="reward-points">10 pts</div>
      <div class="reward-desc">5% Discount on next appointment</div>
    </div>

    <div class="reward-card">
      <div class="reward-points"> 20 pts</div>
      <div class="reward-desc">One Free Clinic Service</div>
    </div>

    <div class="reward-card">
      <div class="reward-points"> 30 pts</div>
      <div class="reward-desc">Premium Priority Appointment Slot</div>
    </div>

  </div>
`;
    } catch (err) {
      console.error("Failed to load points:", err);
      info.innerHTML =
        `<p class="text-danger">Failed to load your points.</p>`;
    }
  }

  loadPoints();
}



