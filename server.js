const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const app = express();
const PORT = process.env.PORT || 4000;
const BACKEND_API = process.env.BACKEND_API || "https://appointment-system-iw83.onrender.com";
process.env.TZ = "Asia/Riyadh";
// === MongoDB ===
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/fakeClinic";
mongoose.connect(MONGO_URL);

// === Model ===
const UserSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now },
});
const ClinicUser = mongoose.model("ClinicUser", UserSchema);

// === Middleware ===
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// === Routes ===

// Home page → choose login or signup
app.get("/", (req, res) => {
  res.render("home", { API: BACKEND_API });
});

// Signup page
app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

// Handle signup
app.post("/signup", async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password)
    return res.render("signup", { error: "All fields required" });

  const exists = await ClinicUser.findOne({ phone });
  if (exists)
    return res.render("signup", { error: "Phone already registered!" });

  const hash = await bcrypt.hash(password, 10);

  // 1️⃣ Create the user (phone still stored)
  await ClinicUser.create({ name, phone, password: hash });
  console.log(`🆕 New user: ${name}`);


  res.redirect("/login");
});

// === Connect Telegram page ===
app.get("/connect-telegram", (req, res) => {
  const { name } = req.query;
  if (!name) return res.redirect("/login");
  res.render("connect-telegram", { name, phone: req.query.phone });;
});

app.get("/check-telegram", async (req, res) => {
  const user = await ClinicUser.findOne({ name: req.query.user });
  if (!user) return res.json({ linked: false });

  res.json({ linked: user.telegramLinked });
});

// Login page
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// Handle login (supports hard-coded admin + normal users)
app.post("/login", async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.render("login", { error: "Missing fields" });

  // --- Simple admin shortcut (for local testing only) ---
  // NOTE: storing plaintext creds in code is only for quick local testing.
  // For anything beyond testing, move these to environment variables.
  if (name === "admin" && password === "1234") {
    return res.redirect("/admin/dashboard");
  }

  // --- Normal user login using bcrypt hashes ---
  try {
    const user = await ClinicUser.findOne({ name });
    if (!user) return res.render("login", { error: "User not found" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.render("login", { error: "Wrong password" });

    return res.redirect(
      `/user/available?userName=${encodeURIComponent(user.name)}&phone=${user.phone}`
    );

  } catch (err) {
    console.error("Login error:", err);
    return res.render("login", { error: "Server error. Try again." });
  }
});

// === User Pages ===
app.get("/user/available", (req, res) => {
  const { userName, phone } = req.query;
  if (!phone) return res.redirect("/login");
  res.render("user/available", { API: BACKEND_API, userName, phone });
});

app.get("/user/booked", (req, res) => {
  const { userName, phone } = req.query;
  res.render("user/booked", { API: BACKEND_API, userName, phone });
});

app.get("/user/loyalty", (req, res) => {
  const { userName, phone } = req.query;
  res.render("user/loyalty", { API: BACKEND_API, userName, phone });
});
app.get("/user/doctors", (req, res) => {
  const { userName, phone } = req.query;
  res.render("user/doctors", { API: BACKEND_API, userName, phone });
});

app.get("/user/times", (req, res) => {
  const { doctor, userName, phone } = req.query;
  res.render("user/times", { API: BACKEND_API, doctor, userName, phone });
});
app.get("/user/past", (req, res) => {
  const { userName, phone } = req.query;
  res.render("user/past", { API: BACKEND_API, userName, phone });
});
// === Admin Pages ===
app.get("/admin/dashboard", (req, res) => {
  res.render("admin/dashboard", { API: BACKEND_API });
});
app.get("/admin/add-block", (req, res) => {
  res.render("admin/add-block", { API: BACKEND_API });
});
app.get("/admin/baseline", (req, res) => {
  res.render("admin/baseline", { API: BACKEND_API });
});
app.get("/admin/booked", (req, res) => {
  res.render("admin/booked", { API: BACKEND_API });
});

app.get("/admin/performance", (req, res) => {
  res.render("admin/performance", { API: BACKEND_API });
});


// === Start Server ===
app.listen(PORT, () =>
  console.log(`🏥 Fake Clinic running on http://localhost:${PORT}`)
);

