const express = require("express");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const { createTokenForUser, checkForAuthentication } = require("./authMiddleware");

const app = express();
const PORT = 3000;

// Middleware
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session setup (must be BEFORE checkForAuthentication)
app.use(session({
  secret: "secretKey",
  resave: false,
  saveUninitialized: true
}));

app.use(checkForAuthentication);

// Fake user database
const users = [];

// Routes
app.get("/", (req, res) => {
  res.render("login", { error: null });
});

app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", (req, res) => {
  const { username, password } = req.body;

  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.render("signup", { error: "User already exists!" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  users.push({ username, password: hashedPassword });

  // Set session after signup
  req.session.user = { username }; // Only username for session
  res.redirect("/dashboard");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user) {
    return res.render("login", { error: "User not found!" });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.render("login", { error: "Invalid password!" });
  }

  // ✅ Corrected session assignment
  req.session.user = { username: user.username };
  res.redirect("/dashboard");
});

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  res.render("dashboard", { user: req.session.user });
});

// Profile page
// Profile page
app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  // Find user in array
  const currentUser = users.find(u => u.username === req.session.user.username);
  res.render("profile", { user: currentUser });
});

// Handle profile update
// Profile update
app.post("/update-profile", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { dob, occupation, state, city, interests, favSports, about } = req.body;

  // Find user in our "database"
  const user = users.find(u => u.username === req.session.user.username);
  if (user) {
    user.dob = dob;
    user.occupation = occupation;
    user.state = state;
    user.city = city;
    user.interests = interests;
    user.favSports = favSports;
    user.about = about;

    // Update session user
    req.session.user = user;
  }

  res.redirect("/profile"); // redirect back to profile
});

app.get("/map", (req, res) => {
  res.render("map");  // map.ejs render hoga
});
// About / Learn About Safety page
app.get("/learnaboutsafety", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/"); // redirect to login if not logged in
  }
  res.render("aboutSafety", { user: req.session.user }); // render your EJS file
});

// About Safety Page
// About Page
app.get("/about", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/"); // redirect to login if not logged in
  }
  res.render("about", { user: req.session.user });
});







// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
