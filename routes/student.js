// backend/routes/student.js
const express = require('express');
// THIS IS THE FIX: It now correctly imports your PostgreSQL database pool
const pool = require('../db');
const router = express.Router();

// --- Mark Attendance (Geo-fencing REMOVED) ---
router.post('/mark-attendance', async (req, res) => {
    const { lectureId, studentId } = req.body; 

    try {
        const existingCheck = await pool.query(
            'SELECT * FROM attendance WHERE lecture_id = $1 AND student_id = $2',
            [lectureId, studentId]
        );

        if (existingCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Attendance already marked for this lecture.' });
        }

        const result = await pool.query(
            'INSERT INTO attendance (lecture_id, student_id, status) VALUES ($1, $2, $3) RETURNING id',
            [lectureId, studentId, 'present']
        );
        
        res.status(201).json({ 
            message: 'Attendance marked successfully!',
            newRecordId: result.rows[0].id 
        });

    } catch (error) {
        console.error("Error in /mark-attendance:", error);
        res.status(500).json({ error: 'Server error while marking attendance.' });
    }
});

// --- GET All Lectures for a Student ---
router.get('/lectures', async (req, res) => {
    try {
        const query = `
            SELECT lectures.*, users.name as teacher_name 
            FROM lectures 
            JOIN users ON lectures.teacher_id = users.id 
            WHERE users.role = 'teacher'
            ORDER BY lectures.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching lectures for student:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- GET a specific student's attendance history ---
router.get('/attendance/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const result = await pool.query(
            'SELECT * FROM attendance WHERE student_id = $1 ORDER BY timestamp DESC',
            [studentId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching attendance history:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;