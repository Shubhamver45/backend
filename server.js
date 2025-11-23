// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors'); // We need CORS

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');

const app = express();
// Render provides this PORT, or we use 3001 for local testing
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Allow requests from your Netlify frontend
app.use(express.json()); // Allow server to accept JSON data

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);

// Test route
app.get('/', (req, res) => {
    res.send('Smart Attendance Backend is running!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});