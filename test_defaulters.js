require('dotenv').config();
const pool = require('./db');

async function testQuery() {
    try {
        const teacherRes = await pool.query("SELECT id FROM users WHERE role = 'teacher' LIMIT 1");
        if (teacherRes.rows.length === 0) {
            console.log("No teacher found.");
            process.exit(0);
        }
        const teacherId = teacherRes.rows[0].id;
        console.log("Teacher ID:", teacherId);

        const totalLecturesResult = await pool.query(`
            SELECT 
                (SELECT COUNT(id) FROM lectures WHERE teacher_id = $1) + 
                (SELECT COUNT(id) FROM archived_lectures WHERE teacher_id = $1) as total
        `, [teacherId]);
        const totalLectures = parseInt(totalLecturesResult.rows[0].total || 0);
        console.log("Total Lectures:", totalLectures);

        if (totalLectures === 0) {
            console.log("0 lectures.");
            process.exit(0);
        }

        const attendanceCountsResult = await pool.query(`
            WITH deduplicated_students AS (
                SELECT DISTINCT ON (COALESCE(NULLIF(TRIM(roll_number), ''), id)) id, name, roll_number, enrollment_number
                FROM users 
                WHERE role = 'student'
                ORDER BY COALESCE(NULLIF(TRIM(roll_number), ''), id), created_at DESC
            )
            SELECT ds.id, ds.name, ds.roll_number, ds.enrollment_number, COUNT(combined_att.lecture_id) as attended_count
            FROM deduplicated_students ds
            LEFT JOIN (
                SELECT student_id, lecture_id FROM attendance WHERE lecture_id IN (SELECT id FROM lectures WHERE teacher_id = $1)
                UNION ALL
                SELECT student_id, lecture_id FROM archived_attendance WHERE lecture_id IN (SELECT original_lecture_id FROM archived_lectures WHERE teacher_id = $1)
            ) combined_att ON ds.id = combined_att.student_id
            GROUP BY ds.id, ds.name, ds.roll_number, ds.enrollment_number
        `, [teacherId]);

        console.log("Rows returned:", attendanceCountsResult.rows.length);
        console.log(attendanceCountsResult.rows);
        
        const defaulters = attendanceCountsResult.rows.map(student => ({
            ...student,
            attended_count: parseInt(student.attended_count),
            total_lectures: totalLectures,
            percentage: (parseInt(student.attended_count) / totalLectures) * 100
        })).filter(student => student.percentage < 75);

        console.log("Defaulters length:", defaulters.length);
        console.log(defaulters);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}
testQuery();
