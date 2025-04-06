require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const http = require('http');
const socketio = require('socket.io');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Note = require('./models/Note'); // Make sure this path is correct

// Initialize Express and HTTP server
const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = socketio(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"]
  }
});

// Middleware Setup
app.use(cors());
app.use(express.json());

// Rate Limiting (15 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many requests, please try again later.'
});
app.use(limiter);

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// DeepSeek API Configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Health Check
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'active',
    message: 'LearnFlow backend is running'
  });
});

// AI Chat Endpoint
app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Invalid question format' });
    }

    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: question }],
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        }
      }
    );

    res.json({ answer: response.data.choices[0].message.content });

  } catch (error) {
    console.error('DeepSeek Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'AI service unavailable',
      details: error.response?.data?.message || error.message
    });
  }
});

// File Upload Endpoint
app.post('/api/notes/:id/upload', 
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const fileUrl = `/uploads/${req.file.filename}`;
      await Note.findByIdAndUpdate(req.params.id, {
        $push: { attachments: fileUrl }
      });
      
      res.json({ fileUrl });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'File upload failed' });
    }
  }
);

// Socket.IO events
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Join a note room
  socket.on('join-note', (noteId) => {
    socket.join(noteId);
  });
  
  // Handle real-time edits
  socket.on('note-edit', ({ noteId, changes }) => {
    socket.to(noteId).emit('update-note', changes);
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});