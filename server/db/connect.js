// server/db/connect.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/learnflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s
      maxPoolSize: 10 // Maximum connections
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('Database Connection Error:', err);
    process.exit(1);
  }
};

// Connection events
mongoose.connection.on('connected', () => 
  console.log('Mongoose connected to DB'));

mongoose.connection.on('error', (err) => 
  console.error('Mongoose connection error:', err));

mongoose.connection.on('disconnected', () => 
  console.log('Mongoose disconnected'));

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = connectDB;