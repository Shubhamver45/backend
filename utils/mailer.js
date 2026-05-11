// backend/utils/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail
        pass: process.env.EMAIL_PASS  // Your Gmail App Password
    }
});

/**
 * Sends a Deficiency Alert email to Parent, Mentor, and Teacher
 * @param {Object} student - Student details (name, roll_number, email)
 * @param {Object} contacts - Email addresses for stakeholders
 * @param {Number} percentage - Current attendance percentage
 */
const sendDeficiencyEmail = async (student, contacts, percentage) => {
    const { student_email, parents_email, mentor_email, subject_teacher_email } = contacts;
    
    // Recipients list: Send to student too so testing works if parents email is empty!
    const recipients = [student_email, parents_email, mentor_email, subject_teacher_email].filter(Boolean);
    
    if (recipients.length === 0) {
        console.log(`⚠️ No emails found for student ${student.name}. Skipping alert.`);
        return;
    }

    const mailOptions = {
        from: `"Attendance Management System" <${process.env.EMAIL_USER}>`,
        to: recipients.join(', '),
        subject: `🚨 Attendance Deficiency Alert: ${student.name}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #d32f2f; text-align: center;">Attendance Deficiency Alert</h2>
                <p>Dear Stakeholders,</p>
                <p>This is an automated notification regarding the attendance records for the following student:</p>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${student.name}</p>
                    <p style="margin: 5px 0;"><strong>Roll Number:</strong> ${student.roll_number}</p>
                    <p style="margin: 5px 0;"><strong>Current Attendance:</strong> <span style="color: #d32f2f; font-weight: bold;">${percentage.toFixed(2)}%</span></p>
                </div>
                
                <p>The student's attendance has fallen below the mandatory threshold of <strong>75%</strong>. This may impact academic eligibility and performance.</p>
                
                <p>Please take the necessary steps to ensure regular attendance in future lectures. If there is a valid reason for absence, please provide the required documentation to the Class Teacher immediately.</p>
                
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #777; text-align: center;">
                    This is an automated system message. Please do not reply directly to this email.
                </p>
            </div>
        `
    };

    try {
        // BYPASS RENDER FIREWALL: If Google Script URL is provided, use HTTP API (Port 443) instead of SMTP (Port 465)
        if (process.env.GOOGLE_SCRIPT_URL) {
            console.log(`🚀 Sending email via Google Apps Script API to bypass Render firewall...`);
            const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: mailOptions.to,
                    subject: mailOptions.subject,
                    html: mailOptions.html
                })
            });
            
            const result = await response.json();
            if (result.status === 'success') {
                console.log(`✅ Deficiency alert sent via Google Script for ${student.name} to ${recipients.length} recipients.`);
            } else {
                throw new Error(result.error || 'Unknown Google Script error');
            }
        } else {
            // Local fallback (uses standard nodemailer SMTP)
            await transporter.sendMail(mailOptions);
            console.log(`✅ Deficiency alert sent via SMTP for ${student.name} to ${recipients.length} recipients.`);
        }
    } catch (error) {
        console.error(`❌ Failed to send email for ${student.name}:`, error.message);
    }
};

/**
 * Sends a Leave Request Notification email to the Class Teacher
 */
const sendLeaveNotificationEmail = async (studentName, teacherEmail, leaveDetails) => {
    if (!teacherEmail) return;

    const mailOptions = {
        from: `"Smart Attendance System" <${process.env.EMAIL_USER}>`,
        to: teacherEmail,
        subject: `📝 Leave Request: ${studentName}`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <h2 style="color: #052659; margin-top: 0;">New Leave Request</h2>
                <p>Hello Teacher,</p>
                <p>A new leave request has been submitted by <strong>${studentName}</strong> and is awaiting your review.</p>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #052659;">
                    <p style="margin: 5px 0;"><strong>Date Range:</strong> ${leaveDetails.start_date} to ${leaveDetails.end_date}</p>
                    <p style="margin: 5px 0;"><strong>Reason:</strong> ${leaveDetails.reason}</p>
                </div>
                
                <p>Please log in to the Smart Attendance System dashboard to Approve or Reject this request.</p>
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://smart-attendance-system-virid.vercel.app" style="background-color: #052659; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Request</a>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;" />
                <p style="font-size: 12px; color: #64748b; text-align: center;">
                    This is an automated notification from the Smart Attendance System.
                </p>
            </div>
        `
    };

    try {
        if (process.env.GOOGLE_SCRIPT_URL) {
            await fetch(process.env.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html })
            });
        } else {
            await transporter.sendMail(mailOptions);
        }
        console.log(`✅ Leave notification sent to ${teacherEmail}`);
    } catch (error) {
        console.error(`❌ Failed to send leave notification:`, error.message);
    }
};

module.exports = { sendDeficiencyEmail, sendLeaveNotificationEmail };
