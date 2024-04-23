require("dotenv").config();

const mongoose = require("mongoose");

// Connect to MongoDB 
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected successfully');
    // Continue with your application logic
  })
  .catch(error => {
    console.error('Error connecting to MongoDB:', error);
    // Handle the error appropriately, such as exiting the application or retrying the connection
  });


const User = require("./models/user.model");
const Note = require("./models/note.model");

const express = require("express");
const cors = require("cors");

const app = express();

const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

// test
app.get("/", (req, res) => {
  res.json({ data: "Welcome" });
});

// create account
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName) {
    return res
      .status(404)
      .json({ error: true, message: "Please enter a full name" });
  }
  if (!email) {
    return res
      .status(404)
      .json({ error: true, message: "Please enter email address" });
  }
  if (!password) {
    return res
      .status(404)
      .json({ error: true, message: "Please enter password" });
  }
  const isUser = await User.findOne({ email: email });

  if (isUser) {
    return res.json({ error: true, message: "user already exists" });
  }
  const user = new User({ fullName, email, password });

  await user.save();

  const accessToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });

  return res.json({
    error: false,
    user,
    accessToken,
    message: "account created success",
  });
});

// login account
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res
      .status(404)
      .json({ error: true, message: "Please enter email address" });
  }
  if (!password) {
    return res
      .status(404)
      .json({ error: true, message: "Please enter password" });
  }
  const userInfo = await User.findOne({ email: email });

  if (!userInfo) {
    return res.json({ error: true, message: "user not found" });
  }

  if (userInfo.email === email && userInfo.password === password) {
    const user = { user: userInfo };
    const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1d",
    });

    return res.json({
      error: false,
      email,
      accessToken,
      message: "login success",
    });
  } else {
    res.json({ error: true, message: "Invalid username or password" });
  }
});

// get user
app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;

  const isUser = await User.findOne({ _id: user._id });

  if (!isUser) {
    return res.sendStatus(401).json({ error: true, message: "user not found" });
  }

  return res.json({
    user: {
      fullName: isUser.fullName,
      email: isUser.email,
      _id: isUser._id,
      createdOn: isUser.createdOn,
    },
    message: "",
  });
});

// add note
app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;

  const { user } = req.user;

  if (!title) {
    return res.status(404).json({ error: true, message: "Please enter title" });
  }

  if (!content) {
    return res
      .status(404)
      .json({ error: true, message: "Please enter content" });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: user._id,
    });

    await note.save();

    return res.json({
      error: false,
      note,
      message: "note created successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "note not created",
    });
  }
});

// edit note
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content, tags, isPinned } = req.body;

  const { user } = req.user;

  if (!title && !content && !tags) {
    return res.status(400).json({ error: true, message: "No change provided" });
  }

  try {
    const note = await Note.findOne({
      _id: noteId,
      userId: user._id,
    });

    if (!note) {
      return res.status(404).json({ error: true, message: "note not found" });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "note updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "note not updated",
    });
  }
});

// get all note
app.get("/get-all-notes", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const notes = await Note.find({ userId: user._id }).sort({ isPinned: -1 });
    return res.json({
      error: false,
      notes,
      message: "notes retrieved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "note not retrieved",
    });
  }
});

// delete the note
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { user } = req.user;

  try {
    const note = await Note.findOne({ _id: noteId });

    if (!note) {
      return res.status(404).json({ error: true, message: "note not found" });
    }

    await Note.deleteOne({ _id: note, userId: user._id });

    return res.json({
      error: false,
      message: "note deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "note not deleted",
    });
  }
});

// update isPinned value in note
app.put("/update-note-pinned/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { isPinned } = req.body;
  const { user } = req.user;

  try {
    const note = await Note.findOne({
      _id: noteId,
      userId: user._id,
    });

    if (!note) {
      return res.status(404).json({ error: true, message: "note not found" });
    }

    note.isPinned = isPinned;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "note updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "note not updated",
    });
  }
});

// search
app.get("/search-note", authenticateToken, async (req, res) => {
  // Destructure user from req.user directly
  const { user } = req;

  // Extract query from req.query directly
  const query = req.query.query;

  // Check if query exists
  if (!query) {
    return res.status(400).json({ error: true, message: "Search query required" });
  }

  try {
    // Use user._id directly instead of destructuring user
    const matchNote = await Note.find({
      userId: user._id,
      $or: [
        { title: { $regex: new RegExp(query, "i") } },
        { content: { $regex: new RegExp(query, "i") } },
      ],
    });

    // Return the response
    return res.json({
      error: false,
      matchNote,
      message: "Note found successfully",
    });
  } catch (error) {
    // Handle any internal server error
    return res.status(500).json({
      error: true,
      message: "Internal error",
    });
  }
});



app.listen(8080, () => {
  console.log("server listening on port 8080");
});

module.exports = app;
