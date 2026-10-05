import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

test('assignment API validates prerequisites and duplicate enrollment', async (context) => {
  const port = 3100 + Math.floor(Math.random() * 1000)
  const server = spawn(process.execPath, [fileURLToPath(new URL('./index.js', import.meta.url))], {
    cwd: process.cwd(),
    env: { ...process.env, API_PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let serverError = ''
  server.stderr.setEncoding('utf8')
  server.stderr.on('data', (chunk) => { serverError += chunk })
  const baseUrl = `http://127.0.0.1:${port}`
  context.after(async () => {
    if (server.exitCode !== null) return
    server.kill()
    await once(server, 'exit')
  })

  let studentsResponse
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      studentsResponse = await fetch(`${baseUrl}/api/students`)
      if (studentsResponse.ok) break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  assert.equal(studentsResponse?.status, 200, serverError || 'API server did not respond')
  assert.equal((await studentsResponse.json()).length, 5)

  const catalogResponse = await fetch(`${baseUrl}/api/courses?studentId=STU-1042`)
  const courses = await catalogResponse.json()
  assert.equal(courses.find((course) => course.code === 'CS210').eligible, true)
  assert.equal(courses.find((course) => course.code === 'CS330').eligible, false)

  const assignmentResponse = await fetch(`${baseUrl}/api/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'STU-1042', courseCode: 'CS210' }),
  })
  assert.equal(assignmentResponse.status, 201)
  const assignment = await assignmentResponse.json()

  const duplicateResponse = await fetch(`${baseUrl}/api/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'STU-1042', courseCode: 'CS210' }),
  })
  assert.equal(duplicateResponse.status, 409)

  const removeResponse = await fetch(`${baseUrl}/api/assignments/${assignment.id}`, { method: 'DELETE' })
  assert.equal(removeResponse.status, 204)
})