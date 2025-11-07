require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const session = require("express-session");
const validator = require("validator"); 
//const passport = require("passport");
const dotenv = require("dotenv");
//const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bodyParser = require("body-parser");
const { createTokenForUser, checkForAuthentication } = require("./authMiddleware");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
//app.use(passport.initialize());
//app.use(passport.session());
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
  timestamp: { type: Date, default: Date.now },
  location: {
    latitude: Number,
    longitude: Number,
  },

  

  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
  sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }] 


});
const User = mongoose.model("User", UserSchema);
  const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
    imageUrl:{
    type: String,
    } ,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model("Message", messageSchema);


app.get("/", (req, res) => {
  res.render("login", { error: null });
});

// Get for signup
app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

// Signup Post

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.render("signup", { error: "All fields are required!" });
    }

    if (!validator.isEmail(email)) {
      return res.render("signup", { error: "Invalid email format!" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("signup", { error: "Email already in use!" });
    }

    if (password.length < 3) {
      return res.render("signup", { error: "Password must be at least 3 characters long!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    req.session.user = newUser;

    return res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    return res.render("signup", { error: "Something went wrong!" });
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
    req.session.user = {
      _id: user._id,
      username: user.name,
      email: user.email
    };

    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.render("login", { error: "Something went wrong!" });
  }
});


// Multer setup for file uploads

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});


const upload = multer({ storage: storage });

// Profile 

app.get("/profile", async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  try {
    const currentUser = await User.findById(req.session.user._id);
    if (!currentUser) {
      console.log(" No user found for ID:", req.session.user._id);
      return res.redirect("/dashboard");
    }

    res.render("profile", { user: currentUser });
  } catch (err) {
    console.error(" Profile error:", err);
    res.status(500).send("Internal Server Error");
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

    await User.findByIdAndUpdate(req.session.user._id, updateData, { new: true });
    res.redirect("/profile");
  } catch (err) {
    console.error("❌ Update profile error:", err);
    res.status(500).send("Internal Server Error");
  }
});



//get for dashboard  (after login/signup)  - renders the dashboard page with user info ...
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const pendingRequestsCount = req.session.pendingCount || 0;

  res.render("dashboard", {
    user: req.session.user,
    pendingRequestsCount
  });
});


//get for map
app.get("/map", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.render("map", { user: req.session.user });
});


//get for learn about safety
app.get("/learnaboutsafety", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.render("aboutSafety", { user: req.session.user });
});

//get for mapdetails
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




//fetch locations of all users except current username
app.get("/api/locations", async (req, res) => {
  try {
    const currentUser = await User.findById(req.session.user._id);

    const users = await User.find(
      { "location.latitude": { $exists: true }, 
      "location.longitude": { $exists: true },
       _id: { $ne: currentUser._id } },//$ne-not equal operator in MongoDB.
      { name: 1, location: 1, interests: 1, dp: 1, friends: 1, friendRequests: 1, sentRequests: 1 }
    );

    const result = users.map(u => {
      let status = "Add Friend";
      if (currentUser.friends.includes(u._id)) status = "Friends";
      else if (u.friendRequests.includes(currentUser._id) || currentUser.sentRequests.includes(u._id)) status = "Pending";

      return {
        _id: u._id,
        name: u.name,
        dp: u.dp,
        location: u.location,
        interests: u.interests,
        requestStatus: status
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});



//get for same interests
app.get("/sameinterest", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  try {
    const currentUser = await User.findById(req.session.user._id)
      .populate("friends", "_id")
      .populate("sentRequests", "_id")
      .populate("friendRequests", "_id");

    const users = await User.find({
      _id: { $ne: currentUser._id },
      interests: { $in: currentUser.interests }
    });

    // Attach status to each user
    const updatedUsers = users.map(u => {
      let status = "none";
      if (currentUser.friends.some(f => f._id.equals(u._id))) status = "friends";
      else if (currentUser.sentRequests.some(r => r._id.equals(u._id))) status = "sent";
      else if (currentUser.friendRequests.some(r => r._id.equals(u._id))) status = "pending";
      return { ...u.toObject(), status };
    });

    res.render("sameinterest", { users: updatedUsers });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


app.get("/alluser", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/");
    }
    const currentUser = await User.findById(req.session.user._id)
      .populate("friends sentRequests friendRequests");
    if (!currentUser) {
      return res.redirect("/");
    }
    const users = await User.find({ _id: { $ne: currentUser._id } });
    res.render("alluser", { users, currentUser, error: null });
  } catch (err) {
    console.error(err);
    res.render("alluser", { users: [], currentUser: null, error: "Failed to load users" });
  }
});


app.get("/userGuide", (req, res) => {
  res.render("userGuide");
});



// Send Friend Request
app.post("/friend-request/:toUserId", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Not logged in" });

    const user = await User.findById(req.session.user._id);
    const toUser = await User.findById(req.params.toUserId);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!toUser) return res.status(404).json({ error: "Recipient not found" });

    if (user.friendRequests.includes(toUser._id)) {
      return res.json({ message: "Already sent" });
    }

    user.sentRequests.push(toUser._id);
    toUser.friendRequests.push(user._id);

    await user.save();
    await toUser.save();
   return  res.redirect("/sameinterest"); // ✅ refresh page → request sent


  } catch (err) {
    console.error(err);
    return res.redirect("/sameinterest"); // ❌ on error, still redirect
  }
});

// Accept Friend Request

app.post("/friend-request/accept/:fromUserId", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });

  try {
    const currentUser = await User.findById(req.session.user._id);
    const fromUser = await User.findById(req.params.fromUserId);
    if (!fromUser) return res.status(404).json({ error: "User not found" });

    // Add each other as friends
    currentUser.friends.push(fromUser._id);
    fromUser.friends.push(currentUser._id);

    // Remove request
    currentUser.friendRequests = currentUser.friendRequests.filter(id => id.toString() !== fromUser._id.toString());
    fromUser.sentRequests = fromUser.sentRequests.filter(id => id.toString() !== currentUser._id.toString());

    await currentUser.save();
    await fromUser.save();
    res.redirect("/friendRequest"); 

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});



// Reject Friend Request
app.post("/friend-request/reject/:fromUserId", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });

  try {
    const currentUser = await User.findById(req.session.user._id);

    // Remove from incoming requests
    currentUser.friendRequests = currentUser.friendRequests.filter(
      id => id.toString() !== req.params.fromUserId
    );

    await currentUser.save();

    res.redirect("/friendRequest"); // ✅ refresh page → request gone
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});



app.get("/friend-requests", async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  try {
    const user = await User.findById(req.session.user._id)
      .populate("friendRequests", "name email dp");

    res.render("friendRequests", { requests: user.friendRequests });
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
});


app.get("/sent-requests", async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  try {
    const user = await User.findById(req.session.user._id)
      .populate("sentRequests", "name email dp");

    res.render("sentRequests", { requests: user.sentRequests });
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
});


app.get("/friendRequest", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  try {
    // Populate friendRequests with actual user info
    const user = await User.findById(req.session.user._id)
      .populate("friendRequests", "name email dp"); // populate only needed fields

    // Populate friends too
    const friends = await User.find({ _id: { $in: user.friends } })
      .select("name email dp");

    // ✅ Store the count in session for dashboard use
    req.session.pendingCount = user.friendRequests.length;

    res.render("friendRequest", {
      requests: user.friendRequests,
      friends: friends
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


app.get("/checkalluser", (req, res) => {
  res.render("checkalluser"); 
});


app.get("/chats", async (req, res) => {
  try {
    const loggedInUser = req.session.user;
    if (!loggedInUser) return res.redirect("/login");

    // Fetch all messages involving this user
    const messages = await Message.find({
      $or: [
        { sender: loggedInUser._id },
        { receiver: loggedInUser._id }
      ]
    })
      .populate("sender receiver", "name dp")
      .sort({ timestamp: -1 });

    const userMap = new Map();

    messages.forEach(msg => {
      const isSender = msg.sender._id.toString() === loggedInUser._id.toString();
      const otherUser = isSender ? msg.receiver : msg.sender;

      if (!userMap.has(otherUser._id.toString())) {
        userMap.set(otherUser._id.toString(), {
          _id: otherUser._id,
          name: otherUser.name,
          dp: otherUser.dp,
          lastMessage:
            isSender
              ? `You: ${msg.message}` // show who sent
              : msg.message,
          lastTime: msg.timestamp,
        });
      }
    });

    const users = Array.from(userMap.values());
    users.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

    res.render("chatList", { users });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading chat list");
  }
});


app.get("/chat/:friendId", async (req, res) => {
  const currentUser = req.session.user;
  const friendId = req.params.friendId;

  const friend = await User.findById(friendId);

  // Fetch all chat messages between both users (sorted oldest → newest)
  const messages = await Message.find({
    $or: [
      { sender: currentUser._id, receiver: friendId },
      { sender: friendId, receiver: currentUser._id }
    ]
  }).sort({ timestamp: 1 });

  res.render("chat", { user: currentUser, friend, messages });
});



app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server);

// Start server
server.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});

const onlineUsers = new Map();
io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  // Store online users
  socket.on("user-connected", async (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(` User ${userId} connected with socket ${socket.id}`);

    try {
      const unreadMessages = await Message.find({
        receiver: userId,
        read: false,
      });

      if (unreadMessages.length > 0) {
        console.log(` Sending ${unreadMessages.length} unread messages to user ${userId}`);
      }

      for (const msg of unreadMessages) {
        socket.emit("private-message", {
          senderId: msg.sender,
          message: msg.message,
          timestamp: msg.timestamp,
        });
      }

      //  Mark as read
      await Message.updateMany(
        { receiver: userId, read: false },
        { read: true }
      );
    } catch (err) {
      console.error(" Error sending unread messages:", err);
    }
  });

  //  Handle private messages
  socket.on("send-private-message", async ({ senderId, receiverId, message }) => {
    try {
      //  Save to DB permanently
      const newMessage = new Message({
        sender: senderId,
        receiver: receiverId,
        message,
        read: false,
        timestamp: new Date(),
      });

      await newMessage.save();

      console.log(` Message saved between ${senderId} -> ${receiverId}`);

      // Send message to sender (for instant display)
      const senderSocket = onlineUsers.get(senderId);
      if (senderSocket) {
        io.to(senderSocket).emit("private-message", {
          senderId,
          receiverId,
          message,
          timestamp: newMessage.timestamp,
        });
      }

      const receiverSocket = onlineUsers.get(receiverId);
      if (receiverSocket) {
        io.to(receiverSocket).emit("private-message", {
          senderId,
          receiverId,
          message,
          timestamp: newMessage.timestamp,
        });
      } else {
        console.log(` Receiver ${receiverId} is offline. Message saved in DB.`);
      }
    } catch (err) {
      console.error(" Error sending private message:", err);
    }
  });
  socket.on("disconnect", () => {
    for (let [userId, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
        console.log(` User ${userId} disconnected`);
        break;
      }
    }
  });
});




