# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # Academic Course Scheduler

  A full-stack semester-planning prototype for registrars and academic advisors. The interface is React + TypeScript, the API is Express, and assignments persist in a local SQLite database. This project does not use Blazor.

  ## Run locally

  Requires Node.js 20.19+ or 22.12+ and npm.

  ```sh
  npm install
  npm run dev
  ```

  Open `http://localhost:5173`. The Vite development server proxies `/api` requests to the Express API on port 3001. The API creates `data/scheduler.sqlite` on first start and seeds the demo records.

  ## Included workflow

  - Browse students with academic year, completed credits and courses, and current term credits.
  - Search courses by title, code, department, or instructor; filter by department and open seats.
  - Assign eligible courses, review rejection reasons, and remove existing assignments.
  - Eligibility is enforced by the API: prerequisites, minimum year, remaining seats, duplicate enrollment, and an 18-credit term limit.

  The five students and eight courses are clearly labeled demo data in `server/index.js`. No sample model was supplied, so replace those records and the explicit demo eligibility rules with the real model before production use.

  ## Checks

  ```sh
  npm run build
  npm test
  npm run lint
  ```

  `npm start` runs only the API. Use `npm run dev` to run both the API and frontend during development.

  ## Data location

  Assignments and catalog records live in `data/scheduler.sqlite` on the machine running the API. The database is ignored by Git. A browser refresh does not lose assignments; separate machines will not share data unless they use the same hosted API and database.
    files: ['**/*.{ts,tsx}'],
