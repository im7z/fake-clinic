const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 4000;
const BACKEND_API = process.env.BACKEND_API || "https://appointment-system-iw83.onrender.com";
process.env.TZ = "Asia/Riyadh";
// === MongoDB ===
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/fakeClinic";
mongoose.connect(MONGO_URL);

// === Model ===
const UserSchema = new mongoose.Schema({
  name: { type: String, unique: true }, // Username used for login (must be unique)
  displayName: String, // Display name shown in the UI (can contain spaces)
  phone: String,
  password: String,
  createdAt: { type: Date, default: Date.now },// Date when user was created
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

// === Handle Signup ===
app.post("/signup", async (req, res) => {
  const { name, displayName, phone, password } = req.body;
  try {
    // 1) Required fields
    if (!name || !displayName || !phone || !password) {
      return res.render("signup", { error: "All fields are required" });
    }

    // 2) Username must not contain spaces
    if (/\s/.test(name)) {
      return res.render("signup", {
        error: "Username cannot contain spaces."
      });
    }

    // 3) Convert username to lowercase for storage
    const normalizedUsername = name.toLowerCase();

    // 4) Check duplicate username (case-insensitive)
    const existingUser = await ClinicUser.findOne({
      name: new RegExp(`^${normalizedUsername}$`, "i")
    });

    if (existingUser) {
      return res.render("signup", {
        error: "This username is already taken. Please choose another one."
      });
    }

    // 5) Save password AS PLAIN STRING (NO HASHING)
    await ClinicUser.create({
      name: normalizedUsername,  // stored lowercase
      displayName,               // friendly name shown in UI
      phone,
      password                   // saved as plain string
    });

    console.log(` New user created: ${normalizedUsername}`);

    // 5) Sync with API
    await axios.post(`${BACKEND_API}/users/register`, {
      userName: normalizedUsername,
      displayName,
      phone
    });

    console.log("🔄 Synced user to API:", normalizedUsername);

    res.redirect("/login");

  } catch (err) {
    console.error("Signup error:", err);
    return res.render("signup", { error: "Server error" });
  }
});


// === Connect Telegram page ===
app.get("/connect-telegram", (req, res) => {
  const { name, phone } = req.query;

  // Redirect if required fields are missing
  if (!name || !phone) return res.redirect("/login");

  // Render page with correct data
  res.render("connect-telegram", { name, phone });
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

// Handle login
app.post("/login", async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password)
    return res.render("login", { error: "Missing fields" });

  // --- Admin quick login ---
  if (name === "admin" && password === "1234") {
    return res.redirect("/admin/dashboard");
  }

  try {
    // Convert username to lowercase (because we stored it lowercase)
    const normalizedUsername = name.toLowerCase();

    // Find user case-insensitive
    const user = await ClinicUser.findOne({
      name: normalizedUsername
    });

    if (!user)
      return res.render("login", { error: "User not found" });

    // Compare plain text password (because you removed hashing)
    const ok = password === user.password;
    if (!ok)
      return res.render("login", { error: "Wrong password" });

    // Success → redirect to user UI
    return res.redirect(
      `/user/available?userName=${encodeURIComponent(user.name)}&phone=${user.phone}`
    );

  } catch (err) {
    console.error("Login error:", err);
    return res.render("login", { error: "Server error. Try again." });
  }
});

app.get("/user/available", async (req, res) => {
  const { userName, phone } = req.query;
  if (!userName) return res.redirect("/login");  // safer check

  const user = await ClinicUser.findOne({ name: userName });

  const displayName = user?.displayName || userName;

  res.render("user/available", {
    API: BACKEND_API,
    userName,
    phone,
    displayName
  });
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

