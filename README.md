# Smart Attendance System - Backend

REST API backend for the Smart Attendance System built with Node.js, Express, and PostgreSQL.

## Features

- 🔐 JWT-based authentication
- 👥 Role-based access control (Teacher & Student)
- 📊 Lecture management
- ✅ Attendance tracking
- 📈 Attendance reports and analytics
- 🗄️ PostgreSQL database

## Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory:
```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# JWT Secret (use a long random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Server Port
PORT=3001

# Environment
NODE_ENV=development
```

3. Set up the database schema:
```sql
-- Users table
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student')),
    roll_number VARCHAR(50),
    enrollment_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lectures table
CREATE TABLE lectures (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    teacher_id VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    lecture_id INTEGER REFERENCES lectures(id),
    student_id VARCHAR(50) REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'present',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lecture_id, student_id)
);

-- Indexes for better performance
CREATE INDEX idx_lectures_teacher ON lectures(teacher_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_lecture ON attendance(lecture_id);
```

4. Start the development server:
```bash
npm run dev
```

For production:
```bash
npm start
```

## API Endpoints

### Authentication

#### Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "id": "string",
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "teacher" | "student",
  "roll_number": "string" (optional, for students),
  "enrollment_number": "string" (optional, for students)
}
```

#### Teacher Login
```
POST /api/auth/teacher/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}
```

#### Student Login
```
POST /api/auth/student/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}
```

### Teacher Routes

#### Create Lecture
```
POST /api/teacher/lectures
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "string",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "teacher_id": "string"
}
```

#### Get Teacher's Lectures
```
GET /api/teacher/lectures/:teacherId
Authorization: Bearer <token>
```

#### Get All Students
```
GET /api/teacher/all-students
Authorization: Bearer <token>
```

#### Get All Attendance Records
```
GET /api/teacher/all-attendance
Authorization: Bearer <token>
```

#### Get Live Attendance for Lecture
```
GET /api/teacher/lectures/:lectureId/attendance
Authorization: Bearer <token>
```

#### Get Lecture Report
```
GET /api/teacher/lecture-report/:lectureId
Authorization: Bearer <token>
```

#### Get Defaulters Report
```
GET /api/teacher/reports/defaulters/:teacherId
Authorization: Bearer <token>
```

### Student Routes

#### Mark Attendance
```
POST /api/student/mark-attendance
Authorization: Bearer <token>
Content-Type: application/json

{
  "lectureId": "number",
  "studentId": "string"
}
```

#### Get All Lectures
```
GET /api/student/lectures
Authorization: Bearer <token>
```

#### Get Student's Attendance History
```
GET /api/student/attendance/:studentId
Authorization: Bearer <token>
```

### Health Check

```
GET /
GET /api/health
```

## Project Structure

```
backend/
├── routes/
│   ├── auth.js        # Authentication routes
│   ├── teacher.js     # Teacher-specific routes
│   └── student.js     # Student-specific routes
├── db.js              # Database connection
├── server.js          # Express app setup
├── package.json       # Dependencies
├── .env               # Environment variables (not in git)
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-secret-key-here` |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:5173` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment mode | `development` or `production` |

## Development

### Running with Auto-reload
```bash
npm run dev
```

### Running in Production
```bash
NODE_ENV=production npm start
```

## Deployment

### Deploy to Render

1. Push your code to GitHub
2. Connect your repository to Render
3. Add environment variables in Render dashboard
4. Deploy!

### Deploy to Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Add environment variables: `railway variables`
5. Deploy: `railway up`

## Security Best Practices

✅ **Implemented:**
- Password hashing with bcrypt
- JWT token authentication
- CORS protection
- SQL injection prevention (parameterized queries)
- Environment variable configuration

⚠️ **Recommendations:**
- Use HTTPS in production
- Implement rate limiting
- Add request validation middleware
- Set up proper logging
- Regular security audits

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Database Schema

See the SQL schema in the installation section above. The database consists of three main tables:

- **users** - Stores teacher and student accounts
- **lectures** - Stores lecture information
- **attendance** - Stores attendance records

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
