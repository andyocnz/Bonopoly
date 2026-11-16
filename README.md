# Bonopoly / AIgopoly - Business Strategy Simulation (React edition)

An open-source multiplayer business strategy simulation for teaching economics, strategy and finance.
Teams run competing companies across regions (pricing, production, R&D, marketing, finance) while an
educator runs the game; AI-controlled rival teams, a Strategy Lab for batch experiments, and 20+
classroom economics mini-games (auctions, Cournot/Bertrand, public goods, prisoner's dilemma, etc.) are included.

This is the modern rewrite of the original PHP Bonopoly (see the `master` branch history).
Stack: React + TypeScript (Vite), Node/Express server, Prisma + PostgreSQL.

Licensed under the MIT License - see `LICENSE`.

## Getting started

Copy `.env.example` to `.env` and adjust. A local Postgres is provided via `docker compose up -d`.

## Prerequisites

- Node.js (recommended >= 18)
- npm (bundled with Node)
- PostgreSQL (if you plan to run the database locally) or a connection string to a Postgres instance

Create a `.env` file in the project root with at minimum:

```
DATABASE_URL="postgresql://user:password@localhost:5432/bonopoly_dev"
SESSION_SECRET=your_dev_secret
PORT=3001
```

Adjust values for your environment. The server reads `process.env` via `dotenv`.

## Install

Install node dependencies:

```bash
npm install
```

If you add or update Prisma models, generate the client:

```bash
npx prisma generate
```

Run migrations (creates/updates local DB schema):

```bash
npm run db:migrate
```

Open Prisma Studio (optional):

```bash
npm run db:studio
```

## Available scripts

- `npm run dev` — Start the Vite dev server for the frontend (default port 5173).
- `npm run server` — Start the backend server in watch mode (`tsx watch src/server/index.ts`).
- `npm run dev:all` — Run both server and frontend concurrently.
- `npm run build` — Build the project (TypeScript build + Vite build).
- `npm run preview` — Preview the production build locally.
- `npm run lint` — Run ESLint across the repo.
- `npm run db:migrate` — Run Prisma migrations (`prisma migrate dev`).
- `npm run db:studio` — Open Prisma Studio.
- `npm run simulate:test` — Run the simulation test script.

## Starting the app locally

1. Ensure dependencies are installed:

```bash
npm install
```

2. Ensure `.env` is configured with `DATABASE_URL` and other vars.

3. Generate Prisma client (first time or after schema change):

```bash
npx prisma generate
```

4. Run migrations (first time or when schema changed):

```bash
npm run db:migrate
```

5. Start backend and frontend together:

```bash
npm run dev:all
```

Or in separate terminals:

```bash
npm run server
```

```bash
npm run dev
```

Visit the frontend (usually `http://localhost:5173`) and the backend health check at `http://localhost:3001/api/health` (adjust port via `PORT` env var).

## Useful `npx` / Prisma commands

- `npx prisma migrate dev` — apply migrations and generate client (same as `npm run db:migrate`).
- `npx prisma studio` — open the web UI for the database.

## Troubleshooting

- If `npm run dev` fails due to port conflicts, either change the port or run only the frontend or backend on different ports.
- If Prisma complains about `DATABASE_URL`, verify your `.env` and that Postgres is reachable.
- If TypeScript errors block `npm run build`, run `npx tsc -v` and `npm run lint` to inspect issues.

## Common workflows

- Quick dev (both): `npm run dev:all`
- Backend-only: `npm run server`
- Frontend-only: `npm run dev`
- Reset DB (careful - destructive): run migrations or drop DB then `npm run db:migrate` after adjusting schema/migration files

---

If you'd like, I can also:

- add a `make`/`scripts` helper to simplify common flows, or
- add a `README` under `simulation-test/` describing how to run those scripts in more detail.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
