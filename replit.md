# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: Ontario Mental Health Services Intelligence Dashboard

A BI dashboard powered by a real dataset of 5,945 Ontario mental health service records (KHP 2019 MOH Export). Demonstrates data cleaning, SQL analytics, REST API codegen, and interactive React dashboarding.

**Data pipeline:** Excel (.xlsx) → import script → PostgreSQL → Express API → React dashboard

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── hospital-dashboard/ # Ontario Mental Health Services Dashboard (React + Vite)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
│   └── src/                # import_services.ts — Excel import pipeline
├── attached_assets/        # Source Excel file (KHP 2019 MOH Export)
├── analytics_queries.sql   # All SQL analytics queries (for reference/portfolio)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── README.md
```

## Database Schema

### `services` (5,945 rows)
One row per mental health service record. Key fields: `public_name`, `official_name`,
`bilingual_service` (boolean), `lgbtq_support` (boolean), `harm_reduction` (boolean),
`eligibility_age_group` (derived), `eligibility_by_gender` (normalized),
`physical_city`, `physical_county`, `latitude`, `longitude`.

### `service_taxonomy` (10,265 rows)
Normalized taxonomy terms — one row per (service, term) pair. Enables clean `GROUP BY` analytics.

## Import Pipeline

```bash
pnpm --filter @workspace/scripts run import
```

Reads the Excel file, cleans/transforms 5,945 rows, and inserts into PostgreSQL.

### Auto-seed on startup

`artifacts/api-server/src/initDb.ts` — runs automatically before the server binds to its port. Checks `COUNT(*) FROM services`; if 0, reads the bundled xlsx (`artifacts/api-server/src/khp_2019_moh_export.xlsx`) and imports all 5,945 rows in batches of 200. Subsequent restarts detect the existing rows and skip immediately.

The xlsx is also copied to `dist/` by `build.ts` (for production deployments). The esbuild CJS bundle injects `globalThis.__dirname` via a banner so `initDb.ts` can resolve the xlsx path in both dev (ESM/tsx) and production (CJS bundle) modes.

## API Routes

- `GET /api/analytics/kpis` — KPI aggregations with filter support
- `GET /api/analytics/services-by-category` — top 15 taxonomy terms
- `GET /api/analytics/services-by-county` — top 20 Ontario counties
- `GET /api/analytics/eligibility-by-age` — age group distribution
- `GET /api/analytics/eligibility-by-gender` — gender eligibility distribution
- `GET /api/analytics/language-distribution` — bilingual / EN / FR breakdown
- `GET /api/analytics/services-report` — filterable report table (max 500)
- `GET /api/filters/counties` — distinct county list for dropdowns
- `GET /api/filters/taxonomy-terms` — distinct taxonomy terms for dropdowns

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from root** — `pnpm run typecheck`
- **`emitDeclarationOnly`** — JS bundling by esbuild/tsx/vite
- **Project references** — cross-package dependencies via `references` array

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API. Routes: `analytics.ts` (all chart endpoints), `filters.ts` (dropdown options), `health.ts`.

### `lib/db` (`@workspace/db`)

Drizzle ORM. Schema: `schema/services.ts`, `schema/service_taxonomy.ts`.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks (e.g. `useGetAnalyticsKpis`, `useGetServicesByCategory`).

### `scripts` (`@workspace/scripts`)

`import_services.ts` — reads Excel, cleans data, seeds PostgreSQL.
