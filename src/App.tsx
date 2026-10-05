import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Database,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react'
import './App.css'

type View = 'planner' | 'students' | 'courses' | 'assignments'

type Student = {
  id: string
  name: string
  major: string
  yearLevel: number
  completedCredits: number
  completedCourses: string[]
  currentCredits: number
  assignments: { id: number; code: string; title: string; credits: number }[]
}

type Course = {
  code: string
  title: string
  department: string
  instructor: string
  credits: number
  capacity: number
  availableSeats: number
  minYearLevel: number
  prerequisites: string[]
  meeting: string
  assigned: boolean
  eligible: boolean | null
  reasons: string[]
}

type Assignment = {
  id: number
  studentId: string
  studentName: string
  courseCode: string
  courseTitle: string
  department: string
  credits: number
  assignedAt: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'The request could not be completed')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'planner', label: 'Planner', icon: LayoutDashboard },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'assignments', label: 'Assignments', icon: CalendarDays },
]

function App() {
  const [view, setView] = useState<View>('planner')
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [courseSearch, setCourseSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [seatsOnly, setSeatsOnly] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      request<Student[]>('/api/students'),
      request<Assignment[]>('/api/assignments'),
    ]).then(([studentRows, assignmentRows]) => {
      if (!active) return
      setStudents(studentRows)
      setAssignments(assignmentRows)
      setSelectedStudentId((current) => current || studentRows[0]?.id || '')
      setLoading(false)
    }).catch((error: Error) => {
      if (!active) return
      setNotice({ kind: 'error', text: error.message })
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ studentId: selectedStudentId })
    if (courseSearch) params.set('search', courseSearch)
    if (department) params.set('department', department)
    if (seatsOnly) params.set('seatsOnly', 'true')
    request<Course[]>(`/api/courses?${params}`)
      .then((rows) => { if (active) setCourses(rows) })
      .catch((error: Error) => { if (active) setNotice({ kind: 'error', text: error.message }) })
    return () => { active = false }
  }, [selectedStudentId, courseSearch, department, seatsOnly, students, assignments])

  const selectedStudent = students.find((student) => student.id === selectedStudentId)
  const visibleStudents = students.filter((student) =>
    `${student.name} ${student.id} ${student.major}`.toLowerCase().includes(studentSearch.toLowerCase()),
  )
  const departments = [...new Set(courses.map((course) => course.department))].sort()
  const openSeats = courses.reduce((total, course) => total + course.availableSeats, 0)

  async function refreshRecords() {
    const [studentRows, assignmentRows] = await Promise.all([
      request<Student[]>('/api/students'),
      request<Assignment[]>('/api/assignments'),
    ])
    setStudents(studentRows)
    setAssignments(assignmentRows)
  }

  async function assignCourse(course: Course) {
    if (!selectedStudent) return
    setNotice(null)
    try {
      await request('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({ studentId: selectedStudent.id, courseCode: course.code }),
      })
      await refreshRecords()
      setNotice({ kind: 'success', text: `${course.code} added to ${selectedStudent.name}'s schedule.` })
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message })
    }
  }

  async function removeAssignment(id: number, courseCode: string) {
    setNotice(null)
    try {
      await request(`/api/assignments/${id}`, { method: 'DELETE' })
      await refreshRecords()
      setNotice({ kind: 'success', text: `${courseCode} was removed from the schedule.` })
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message })
    }
  }

  const pageTitle = {
    planner: 'Semester planner',
    students: 'Student directory',
    courses: 'Course catalog',
    assignments: 'Course assignments',
  }[view]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><GraduationCap size={22} strokeWidth={2.3} /></div>
        <div className="brand-copy"><strong>Northfield</strong><span>Academic office</span></div>
        <div className="term-switch"><span className="term-dot" /> SPRING 2027 <ChevronRight size={14} /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => setView(id)}>
              <Icon size={18} strokeWidth={1.8} /> <span>{label}</span>
              {id === 'assignments' && assignments.length > 0 && <span className="nav-count">{assignments.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-status"><span className="storage-icon"><Database size={16} /></span><div><strong>Local database</strong><small>SQLite · saved on this machine</small></div><span className="live-dot" /></div>
          <div className="profile-mini"><div className="avatar avatar-staff">AR</div><div><strong>Alex Rivera</strong><small>Registrar</small></div><button type="button" className="icon-button" aria-label="Account options"><SlidersHorizontal size={16} /></button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="page-header">
          <div><div className="eyebrow">ACADEMIC OPERATIONS <span>/</span> 2027</div><h1>{pageTitle}</h1></div>
          <div className="header-right"><div className="term-label"><CalendarDays size={16} /><span>Spring semester</span><ChevronRight size={14} /></div><div className="avatar avatar-staff">AR</div></div>
        </header>

        <section className="summary-grid" aria-label="Semester overview">
          <article className="summary-item"><div className="summary-icon green"><Users size={17} /></div><div><span>Students</span><strong>{students.length}</strong></div><small>in this cohort</small></article>
          <article className="summary-item"><div className="summary-icon coral"><BookOpen size={17} /></div><div><span>Course sections</span><strong>{courses.length}</strong></div><small>in this catalog</small></article>
          <article className="summary-item"><div className="summary-icon blue"><Activity size={17} /></div><div><span>Open seats</span><strong>{openSeats}</strong></div><small>across filtered courses</small></article>
          <article className="summary-item"><div className="summary-icon yellow"><Check size={17} /></div><div><span>Assignments</span><strong>{assignments.length}</strong></div><small>saved this term</small></article>
        </section>

        {notice && <div className={`notice ${notice.kind}`} role="status"><span>{notice.kind === 'success' ? <Check size={17} /> : <X size={17} />}</span>{notice.text}<button className="icon-button" onClick={() => setNotice(null)} aria-label="Dismiss notice"><X size={16} /></button></div>}

        {view === 'assignments' ? (
          <section className="panel assignment-panel">
            <div className="panel-heading"><div><span className="section-kicker">SPRING 2027</span><h2>Assigned courses</h2></div><span className="soft-count">{assignments.length} total</span></div>
            {assignments.length === 0 ? <div className="empty-state"><CalendarDays size={24} /><strong>No assignments yet</strong><span>Choose a student in Planner and add an eligible course.</span><button className="text-action" onClick={() => setView('planner')}>Open planner <ArrowUpRight size={15} /></button></div> : (
              <div className="assignment-list">
                <div className="assignment-head"><span>STUDENT</span><span>COURSE</span><span>DEPARTMENT</span><span>CREDITS</span><span /></div>
                {assignments.map((assignment) => <div className="assignment-row" key={assignment.id}>
                  <div className="assignment-person"><div className="avatar avatar-student">{initials(assignment.studentName)}</div><div><strong>{assignment.studentName}</strong><small>{assignment.studentId}</small></div></div>
                  <div><strong className="course-code">{assignment.courseCode}</strong><small className="assignment-course-title">{assignment.courseTitle}</small></div>
                  <span className="department-name">{assignment.department}</span><span className="credit-value">{assignment.credits} cr</span>
                  <button className="icon-button remove-button" onClick={() => removeAssignment(assignment.id, assignment.courseCode)} title={`Remove ${assignment.courseCode}`} aria-label={`Remove ${assignment.courseCode} from ${assignment.studentName}`}><X size={17} /></button>
                </div>)}
              </div>
            )}
          </section>
        ) : view === 'students' ? (
          <section className="panel directory-panel">
            <div className="panel-heading"><div><span className="section-kicker">ROSTER</span><h2>Students and academic progress</h2></div><span className="soft-count">{students.length} students</span></div>
            <div className="student-table">
              <div className="student-table-head"><span>STUDENT</span><span>PROGRAM</span><span>YEAR</span><span>COMPLETED</span><span>TERM LOAD</span><span /></div>
              {visibleStudents.map((student) => <button className="student-table-row" key={student.id} onClick={() => { setSelectedStudentId(student.id); setView('planner') }}>
                <span className="assignment-person"><span className="avatar avatar-student">{initials(student.name)}</span><span><strong>{student.name}</strong><small>{student.id}</small></span></span>
                <span>{student.major}</span><span>Year {student.yearLevel}</span><span>{student.completedCredits} credits</span><span>{student.currentCredits} / 18 cr</span><ChevronRight size={16} />
              </button>)}
            </div>
          </section>
        ) : (
          <div className={view === 'planner' ? 'planner-grid' : 'planner-grid catalog-only'}>
            {view === 'planner' && <aside className="panel roster-panel">
              <div className="panel-heading compact-heading"><div><span className="section-kicker">ROSTER</span><h2>Choose a student</h2></div><span className="soft-count">{students.length}</span></div>
              <label className="search-field student-search"><Search size={16} /><input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Find a student" aria-label="Search students" />{studentSearch && <button onClick={() => setStudentSearch('')} aria-label="Clear student search"><X size={15} /></button>}</label>
              <div className="student-list">
                {visibleStudents.map((student) => <button key={student.id} onClick={() => setSelectedStudentId(student.id)} className={selectedStudentId === student.id ? 'student-row selected' : 'student-row'}>
                  <div className="avatar avatar-student">{initials(student.name)}</div><div className="student-row-copy"><strong>{student.name}</strong><span>{student.id} · Year {student.yearLevel}</span></div><span className="student-load">{student.currentCredits}<small>cr</small></span>
                </button>)}
                {visibleStudents.length === 0 && <p className="no-results">No matching students.</p>}
              </div>
              {selectedStudent && <div className="progress-card"><div className="progress-title"><span>ACADEMIC PROGRESS</span><GraduationCap size={17} /></div><strong>{selectedStudent.completedCredits}<small> credits</small></strong><span className="progress-copy">completed toward degree</span><div className="progress-meter"><span style={{ width: `${Math.min(100, selectedStudent.completedCredits / 120 * 100)}%` }} /></div><div className="progress-meta"><span>{selectedStudent.major}</span><span>Year {selectedStudent.yearLevel}</span></div><div className="completed-list"><span>COMPLETED COURSES</span><div>{selectedStudent.completedCourses.map((code) => <span key={code}>{code}</span>)}</div></div></div>}
            </aside>}

            {view === 'courses' && <div className="catalog-student-select"><label htmlFor="catalog-student">Check eligibility for</label><select id="catalog-student" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.id}</option>)}</select></div>}

            <section className="panel course-panel">
              <div className="panel-heading course-heading"><div><span className="section-kicker">{view === 'planner' ? 'BUILD A SCHEDULE' : 'SPRING 2027 OFFERINGS'}</span><h2>{view === 'planner' ? 'Available courses' : 'Course catalog'}</h2>{view === 'planner' && selectedStudent && <p>For <strong>{selectedStudent.name}</strong> · {selectedStudent.currentCredits} of 18 credits assigned</p>}</div><span className="soft-count">{courses.length} courses</span></div>
              <div className="course-toolbar"><label className="search-field"><Search size={16} /><input value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="Search title, code, instructor" aria-label="Search courses" />{courseSearch && <button onClick={() => setCourseSearch('')} aria-label="Clear course search"><X size={15} /></button>}</label><select aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All departments</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select><label className="seats-toggle"><input type="checkbox" checked={seatsOnly} onChange={(event) => setSeatsOnly(event.target.checked)} /><span>Open seats only</span></label></div>
              <div className="course-table">
                <div className="course-table-head"><span>COURSE</span><span>INSTRUCTOR / TIME</span><span>SEATS</span><span>ELIGIBILITY</span><span /></div>
                {loading ? <div className="loading-state">Loading course and student records…</div> : courses.map((course) => <CourseRow key={course.code} course={course} hasStudent={Boolean(selectedStudent)} onAssign={() => assignCourse(course)} />)}
                {!loading && courses.length === 0 && <div className="empty-filter"><Search size={20} /><span>No courses match these filters.</span><button className="text-action" onClick={() => { setCourseSearch(''); setDepartment(''); setSeatsOnly(false) }}>Clear filters</button></div>}
              </div>
              <div className="eligibility-note"><span className="note-mark"><Check size={14} /></span><span>Assignments are checked against prerequisites, year level, seats, duplicate enrollment, and an 18-credit limit.</span></div>
            </section>
          </div>
        )}

        <footer className="page-footer"><span><span className="live-dot" /> All changes save to the local SQLite database</span><span>Academic planning <b>·</b> 2027</span></footer>
      </main>
    </div>
  )
}

function CourseRow({ course, hasStudent, onAssign }: { course: Course; hasStudent: boolean; onAssign: () => void }) {
  const isFull = course.availableSeats === 0
  const allowed = course.eligible === true
  const status = course.assigned ? 'Enrolled' : allowed ? 'Eligible' : isFull ? 'Full' : 'Review'
  return <article className="course-row">
    <div className="course-main"><span className="course-code">{course.code}</span><div><strong>{course.title}</strong><small>{course.department} <b>·</b> {course.credits} credits</small>{course.prerequisites.length > 0 && <span className="prerequisite-line">Prereq: {course.prerequisites.join(', ')}</span>}</div></div>
    <div className="instructor-cell"><strong>{course.instructor}</strong><span><Clock3 size={13} />{course.meeting}</span></div>
    <div className="seat-cell"><div className="seat-count"><strong>{course.availableSeats}</strong><span> / {course.capacity}</span></div><div className="seat-meter"><span className={isFull ? 'full' : ''} style={{ width: `${(course.availableSeats / course.capacity) * 100}%` }} /></div><small>{isFull ? 'No seats' : 'seats open'}</small></div>
    <div className="eligibility-cell"><span className={`eligibility-badge ${course.assigned ? 'enrolled' : allowed ? 'eligible' : isFull ? 'full' : 'review'}`}><span />{status}</span>{!allowed && !course.assigned && course.reasons.length > 0 && <small title={course.reasons.join('. ')}>{course.reasons[0]}</small>}</div>
    <button type="button" className={course.assigned ? 'assign-button done' : 'assign-button'} onClick={onAssign} disabled={!hasStudent || !allowed} title={!allowed && !course.assigned ? course.reasons.join('. ') : `Assign ${course.code}`} aria-label={course.assigned ? `${course.code} already assigned` : `Assign ${course.code}`}>
      {course.assigned ? <Check size={16} /> : <Plus size={16} />}
    </button>
  </article>
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}

export default App
