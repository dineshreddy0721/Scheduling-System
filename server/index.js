import Database from 'better-sqlite3'
import express from 'express'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.API_PORT ?? 3001)
const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url))
mkdirSync(dataDirectory, { recursive: true })

const db = new Database(`${dataDirectory}scheduler.sqlite`)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    major TEXT NOT NULL,
    year_level INTEGER NOT NULL,
    completed_credits INTEGER NOT NULL,
    completed_courses TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS courses (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    instructor TEXT NOT NULL,
    credits INTEGER NOT NULL,
    capacity INTEGER NOT NULL,
    min_year_level INTEGER NOT NULL,
    prerequisites TEXT NOT NULL,
    meeting TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_code)
  );
`)

const seedStudents = [
  ['STU-1042', 'Naomi Brooks', 'Computer Science', 3, 57, ['CS101', 'MATH110', 'STAT200']],
  ['STU-1088', 'Elliot Park', 'Data Science', 2, 32, ['CS101', 'MATH110']],
  ['STU-1104', 'Sofia Ramirez', 'Biology', 4, 84, ['BIOL101', 'CHEM101', 'MATH110']],
  ['STU-1121', 'Theo Jackson', 'Computer Science', 1, 12, ['MATH110']],
  ['STU-1137', 'Priya Shah', 'Economics', 3, 61, ['ECON101', 'MATH110', 'STAT200']],
]

const seedCourses = [
  ['CS101', 'Programming Foundations', 'Computer Science', 'Dr. Amina Okafor', 4, 24, 1, [], 'Mon / Wed · 09:30'],
  ['CS210', 'Data Structures', 'Computer Science', 'Prof. Daniel Kim', 4, 24, 2, ['CS101'], 'Tue / Thu · 11:00'],
  ['CS330', 'Database Systems', 'Computer Science', 'Dr. Lena Fischer', 3, 18, 3, ['CS210'], 'Mon / Wed · 13:00'],
  ['STAT200', 'Applied Statistics', 'Mathematics', 'Dr. Omar Haddad', 3, 22, 2, ['MATH110'], 'Tue / Thu · 09:00'],
  ['ECON215', 'Econometrics', 'Economics', 'Prof. Grace Mensah', 3, 20, 2, ['ECON101', 'STAT200'], 'Mon / Wed · 14:30'],
  ['BIOL240', 'Genetics', 'Biology', 'Dr. Mei Tanaka', 4, 16, 2, ['BIOL101', 'CHEM101'], 'Tue / Thu · 13:30'],
  ['MATH110', 'Calculus I', 'Mathematics', 'Prof. Isaac Bennett', 4, 28, 1, [], 'Mon / Wed · 10:30'],
  ['HIST205', 'Public History', 'Humanities', 'Dr. Camille Laurent', 3, 20, 2, [], 'Fri · 10:00'],
]

const insertStudent = db.prepare(`
  INSERT OR IGNORE INTO students (id, name, major, year_level, completed_credits, completed_courses)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const insertCourse = db.prepare(`
  INSERT OR IGNORE INTO courses (code, title, department, instructor, credits, capacity, min_year_level, prerequisites, meeting)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

if (db.prepare('SELECT COUNT(*) AS count FROM students').get().count === 0) {
  const seed = db.transaction(() => {
    for (const [id, name, major, year, credits, completed] of seedStudents) {
      insertStudent.run(id, name, major, year, credits, JSON.stringify(completed))
    }
    for (const [code, title, department, instructor, credits, capacity, minYear, prerequisites, meeting] of seedCourses) {
      insertCourse.run(code, title, department, instructor, credits, capacity, minYear, JSON.stringify(prerequisites), meeting)
    }
  })
  seed()
}

app.use(express.json())

function getStudent(studentId) {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(studentId)
}

function getEligibility(student, course) {
  const reasons = []
  const completed = JSON.parse(student.completed_courses)
  const prerequisites = JSON.parse(course.prerequisites)
  const enrolled = db.prepare('SELECT 1 FROM assignments WHERE student_id = ? AND course_code = ?').get(student.id, course.code)
  const enrollmentCount = db.prepare('SELECT COUNT(*) AS count FROM assignments WHERE course_code = ?').get(course.code).count
  const termCredits = db.prepare(`
    SELECT COALESCE(SUM(c.credits), 0) AS credits
    FROM assignments a JOIN courses c ON c.code = a.course_code
    WHERE a.student_id = ?
  `).get(student.id).credits

  if (enrolled) reasons.push('Already enrolled')
  if (student.year_level < course.min_year_level) reasons.push(`Requires year ${course.min_year_level} or above`)
  const missing = prerequisites.filter((prerequisite) => !completed.includes(prerequisite))
  if (missing.length) reasons.push(`Complete ${missing.join(', ')} first`)
  if (enrollmentCount >= course.capacity) reasons.push('Course is full')
  if (termCredits + course.credits > 18) reasons.push('Would exceed the 18-credit term limit')

  return { eligible: reasons.length === 0, reasons, availableSeats: Math.max(0, course.capacity - enrollmentCount) }
}

app.get('/api/students', (_request, response) => {
  const students = db.prepare('SELECT * FROM students ORDER BY name').all().map((student) => {
    const assignments = db.prepare(`
      SELECT a.id, c.code, c.title, c.credits
      FROM assignments a JOIN courses c ON c.code = a.course_code
      WHERE a.student_id = ? ORDER BY c.code
    `).all(student.id)
    return {
      id: student.id,
      name: student.name,
      major: student.major,
      yearLevel: student.year_level,
      completedCredits: student.completed_credits,
      completedCourses: JSON.parse(student.completed_courses),
      currentCredits: assignments.reduce((total, assignment) => total + assignment.credits, 0),
      assignments,
    }
  })
  response.json(students)
})

app.get('/api/courses', (request, response) => {
  const { department = '', search = '', studentId = '', seatsOnly = '' } = request.query
  const courses = db.prepare('SELECT * FROM courses ORDER BY department, code').all()
    .filter((course) => !department || course.department === department)
    .filter((course) => {
      const text = `${course.code} ${course.title} ${course.instructor} ${course.department}`.toLowerCase()
      return !search || text.includes(String(search).toLowerCase())
    })
    .map((course) => {
      const student = studentId ? getStudent(studentId) : null
      const eligibility = student ? getEligibility(student, course) : null
      const seats = eligibility?.availableSeats ?? Math.max(0, course.capacity - db.prepare('SELECT COUNT(*) AS count FROM assignments WHERE course_code = ?').get(course.code).count)
      return {
        code: course.code,
        title: course.title,
        department: course.department,
        instructor: course.instructor,
        credits: course.credits,
        capacity: course.capacity,
        availableSeats: seats,
        minYearLevel: course.min_year_level,
        prerequisites: JSON.parse(course.prerequisites),
        meeting: course.meeting,
        assigned: Boolean(eligibility && eligibility.reasons.includes('Already enrolled')),
        eligible: eligibility?.eligible ?? null,
        reasons: eligibility?.reasons ?? [],
      }
    })
    .filter((course) => !seatsOnly || course.availableSeats > 0)
  response.json(courses)
})

app.get('/api/assignments', (_request, response) => {
  const assignments = db.prepare(`
    SELECT a.id, a.student_id AS studentId, s.name AS studentName, c.code AS courseCode,
      c.title AS courseTitle, c.department, c.credits, a.assigned_at AS assignedAt
    FROM assignments a
    JOIN students s ON s.id = a.student_id
    JOIN courses c ON c.code = a.course_code
    ORDER BY s.name, c.code
  `).all()
  response.json(assignments)
})

app.post('/api/assignments', (request, response, next) => {
  try {
    const { studentId, courseCode } = request.body
    const student = getStudent(studentId)
    const course = db.prepare('SELECT * FROM courses WHERE code = ?').get(courseCode)
    if (!student || !course) return response.status(404).json({ error: 'Student or course not found' })

    const eligibility = getEligibility(student, course)
    if (!eligibility.eligible) return response.status(409).json({ error: eligibility.reasons.join('. ') })

    const result = db.prepare('INSERT INTO assignments (student_id, course_code) VALUES (?, ?)').run(studentId, courseCode)
    response.status(201).json({ id: result.lastInsertRowid })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/assignments/:id', (request, response) => {
  const result = db.prepare('DELETE FROM assignments WHERE id = ?').run(request.params.id)
  if (!result.changes) return response.status(404).json({ error: 'Assignment not found' })
  response.status(204).end()
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'The request could not be completed' })
})

app.listen(port, () => {
  console.log(`Scheduler API listening on http://localhost:${port}`)
})