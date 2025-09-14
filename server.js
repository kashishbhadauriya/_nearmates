require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const session = require("express-session");
const bodyParser = require("body-parser");
const { createTokenForUser, checkForAuthentication } = require("./authMiddleware");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/uploads", express.static("uploads")); 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "secretKey",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(checkForAuthentication);

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB Connected");

    // Start server ONLY after DB is connected
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB Error:", err);
  });



const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  dob: String,
  occupation: String,
  state: String,
  city: String,
  interests: String,
  favSports: String,
  about: String,
  dp: String,
  location: {
    latitude: Number,
    longitude: Number,
  },
});

const User = mongoose.model("User", UserSchema);



app.get("/", (req, res) => {
  res.render("login", { error: null });
});

// Get for signup
app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

// Signup Post
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res.render("signup", { error: "User already exists!" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    await User.create({ name: username, email, password: hashedPassword });

    req.session.user = { username, email };
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.render("signup", { error: "Something went wrong!" });
  }
});

// Login Post
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render("login", { error: "User not found!" });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.render("login", { error: "Invalid password!" });
    }

    req.session.user = { username: user.name, email: user.email };
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.render("login", { error: "Something went wrong!" });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });


// Profile 
app.get("/profile", async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  try {
    const currentUser = await User.findOne({ name: req.session.user.username });
    res.render("profile", { user: currentUser });
  } catch (err) {
    console.error(err);
    res.redirect("/dashboard");
  }
});

// Update Profile with DP upload
app.post("/update-profile", upload.single("dp"), async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { dob, occupation, state, city, interests, favSports, about } = req.body;
  const dp = req.file ? "/uploads/" + req.file.filename : null;

  try {
    const updateData = { dob, occupation, state, city, interests, favSports, about };
    if (dp) updateData.dp = dp;

    await User.findOneAndUpdate(
      { name: req.session.user.username },
      updateData,
      { new: true }
    );

    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.redirect("/profile");
  }
});

// ================== OTHER ROUTES ==================

app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  res.render("dashboard", { user: req.session.user });
});

app.get("/map", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.render("map", { user: req.session.user });
});

app.get("/learnaboutsafety", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.render("aboutSafety", { user: req.session.user });
});

app.get("/mapdetails", async (req, res) => {
  try {
    const users = await User.find(
      { "location.latitude": { $exists: true }, "location.longitude": { $exists: true } },
      { name: 1, location: 1 }
    );
    res.render("mapdetails")
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});





app.get("/about", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.render("about", { user: req.session.user });
});

app.post("/save-location", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });

  const { latitude, longitude } = req.body;

  try {
    const updatedUser = await User.findOneAndUpdate(
      { name: req.session.user.username },
      { location: { latitude, longitude } },
      { new: true }
    );

    res.json({ success: true, location: updatedUser.location });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save location" });
  }
});

app.get("/api/locations", async (req, res) => {
  try {
    const users = await User.find(
      { "location.latitude": { $exists: true }, "location.longitude": { $exists: true } },
      { name: 1, location: 1, interests: 1, dp: 1 }//1 refers to include these fields in the result
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});



app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// ================== START SERVER ==================
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
