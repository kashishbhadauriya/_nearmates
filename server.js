require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const { createTokenForUser, checkForAuthentication } = require("./authMiddleware");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session setup 
app.use(session({
  secret: "secretKey",
  resave: false,
  saveUninitialized: true
}));

app.use(checkForAuthentication);

//connect data base
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected"))
.catch(err => console.error(" MongoDB Error:", err));



// Schema
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
  location: {
    latitude: Number,
    longitude: Number,
  }
  
});


const User = mongoose.model("User", UserSchema);


// Get for login
app.get("/", (req, res) => {
  res.render("login", { error: null });
});


//get for signup
app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});


// Signup Post
app.post("/signup", async (req, res) => {
  const { username,email, password } = req.body;
  

  try {
  const existingUser = await User.findOne({email:email});
      if (existingUser) {
      return res.render("signup", { error: "User already exists!" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    await User.create({ name:username, email, password: hashedPassword }); // save in DB

    // Set session after signup
    req.session.user = { username,email };
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.render("signup", { error: "Something went wrong!" });
  }
});

// Login Post
app.post("/login", async (req, res) => {
  const { username,email, password } = req.body;

  try {
    const user = await User.findOne({email }); //  fetch from DB
    if (!user) {
      return res.render("login", { error: "User not found!" });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.render("login", { error: "Invalid password!" });
    }
        req.session.user = { username: user.name, email: user.email }; // store consistent session
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.render("login", { error: "Something went wrong!" });
  }
});

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

// Update Profile
app.post("/update-profile", async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { dob, occupation, state, city, interests, favSports, about,location } = req.body;

  try {
    const updatedUser = await User.findOneAndUpdate(
      { name: req.session.user.username },
      { dob, occupation, state, city, interests, favSports, about,location },
      { new: true }//by true it will gives u updates data and if we use false then it will show old data but new dtaa will store in db...
    );

    req.session.user = { username: updatedUser.name };
    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.redirect("/profile");
  }
});


// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) {      
    return res.redirect("/");
  }
  res.render("dashboard", { user: req.session.user });
});


app.get("/map", (req, res) => {
  if(!req.session.user){
  return res.redirect("/");  
  }
  res.render("map",{user:req.session.user});
});


app.get("/learnaboutsafety", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/"); 
  }
  res.render("aboutSafety", { user: req.session.user }); 
});

app.get("/mapdetails", (req, res) => {
  if (!req.session.user) return res.redirect("/"); 
  res.render("mapdetails",{user:req.session.user}); 
});





app.get("/about", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/"); 
  }
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

// Fetch all user locations
app.get("/api/locations", async (req, res) => {//get json formate of location name id
  try {
    const users = await User.find(
      { "location.latitude": { $exists: true }, "location.longitude": { $exists: true } },
      { name: 1, location: 1,interests:1} 
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});


app.get("/mapdetails", async (req, res) => {
  try {
    const users = await User.find(
      { "location.latitude": { $exists: true }, "location.longitude": { $exists: true } },
      { name: 1, location: 1} 
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});






// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
