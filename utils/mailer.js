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
    const { parents_email, mentor_email, subject_teacher_email } = contacts;
    
    // Recipients list
    const recipients = [parents_email, mentor_email, subject_teacher_email].filter(Boolean);
    
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
        await transporter.sendMail(mailOptions);
        console.log(`✅ Deficiency alert sent for ${student.name} to ${recipients.length} recipients.`);
    } catch (error) {
        console.error(`❌ Failed to send email for ${student.name}:`, error.message);
    }
};

module.exports = { sendDeficiencyEmail };
