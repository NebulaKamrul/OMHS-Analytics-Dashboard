# Ontario Shores — Hospital Operations Analytics Dashboard

A full-stack Business Intelligence dashboard for monitoring hospital operations across departments. Built as a portfolio project demonstrating SQL-driven analytics, relational data modeling, and interactive data visualization.

---

## Architecture Overview

```
Frontend (React + Vite)          Backend (Express.js + Node)      Database (PostgreSQL)
      │                                    │                              │
  React Query hooks  ──────────►  REST API endpoints  ──────────►  Drizzle ORM + raw SQL
  Recharts charts                  Zod validation                  Normalized schema
  TanStack Table                   Route handlers                  Aggregation queries
```

**Data flow:**
1. User sets filters (date range, department) in the React UI
2. React Query hooks call the REST API with filter params
3. Express routes run parameterized SQL queries against PostgreSQL
4. Aggregated data returns as JSON and renders as charts/tables

---

## Database Schema

Six normalized tables with proper foreign key constraints:

```sql
departments   (id, name, code, total_beds, staff_count)
patients      (id, first_name, last_name, date_of_birth, gender, health_card_number)
staff         (id, first_name, last_name, role, department_id → departments)
beds          (id, bed_number, department_id → departments, status)
admissions    (id, patient_id → patients, department_id → departments, bed_id → beds,
               admission_date, discharge_date, status, admission_type)
appointments  (id, patient_id → patients, department_id → departments,
               staff_id → staff, scheduled_at, status, appointment_type)
```

**Design decisions:**
- `admissions` tracks inpatient stays with `admission_date` / `discharge_date` interval
- `appointments` tracks outpatient visits separately (different patient flow)
- `beds` are assigned per department; occupancy is derived at query time
- `staff` is linked to departments for the staff-to-patient ratio KPI

---

## KPIs and How They Are Calculated

| KPI | SQL Logic |
|-----|-----------|
| **Total Admissions** | `COUNT(DISTINCT admissions.id)` in date range |
| **Avg Length of Stay** | `AVG(EXTRACT(EPOCH FROM discharge_date - admission_date) / 86400)` for discharged patients |
| **Bed Occupancy Rate** | `SUM(admitted) / SUM(total_beds) * 100` across departments |
| **Staff-to-Patient Ratio** | `COUNT(staff) / COUNT(currently admitted)` |
| **Total Discharges** | `COUNT WHERE status = 'discharged'` in date range |
| **Total Appointments** | `COUNT(appointments)` in date range |

---

## SQL Queries Powering Each Chart

### Admissions by Month (trend chart)
```sql
SELECT
  TO_CHAR(DATE_TRUNC('month', admission_date), 'YYYY-MM') AS month,
  COUNT(*)::int AS admissions
FROM admissions
WHERE admission_date BETWEEN $startDate AND $endDate
GROUP BY DATE_TRUNC('month', admission_date)
ORDER BY DATE_TRUNC('month', admission_date);
```

### Appointments by Department (stacked bar)
```sql
SELECT
  d.name AS department,
  COUNT(ap.id)::int AS appointments,
  COUNT(CASE WHEN ap.status = 'completed' THEN 1 END)::int AS completed,
  COUNT(CASE WHEN ap.status = 'cancelled' THEN 1 END)::int AS cancelled
FROM appointments ap
JOIN departments d ON ap.department_id = d.id
GROUP BY d.id, d.name
ORDER BY COUNT(ap.id) DESC;
```

### Bed Occupancy by Department (bar chart)
```sql
SELECT
  d.name AS department,
  d.total_beds AS "totalBeds",
  COUNT(CASE WHEN a.status = 'admitted' THEN 1 END)::int AS "occupiedBeds",
  ROUND(
    100.0 * COUNT(CASE WHEN a.status = 'admitted' THEN 1 END)::numeric
      / NULLIF(d.total_beds, 0), 1
  )::float AS "occupancyRate"
FROM departments d
LEFT JOIN admissions a ON a.department_id = d.id
GROUP BY d.id, d.name, d.total_beds
ORDER BY "occupancyRate" DESC;
```

### Average Length of Stay by Department (bar chart)
```sql
SELECT
  d.name AS department,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (discharge_date - admission_date)) / 86400.0)::numeric, 1
  )::float AS "avgDays"
FROM admissions a
JOIN departments d ON a.department_id = d.id
WHERE a.discharge_date IS NOT NULL
GROUP BY d.id, d.name
ORDER BY "avgDays" DESC;
```

### Weekly Discharge Trends (line chart)
```sql
SELECT
  TO_CHAR(DATE_TRUNC('week', discharge_date), 'YYYY-MM-DD') AS week,
  COUNT(*)::int AS discharges
FROM admissions
WHERE discharge_date IS NOT NULL AND status = 'discharged'
GROUP BY DATE_TRUNC('week', discharge_date)
ORDER BY DATE_TRUNC('week', discharge_date);
```

---

## Filtering

All queries accept optional parameters:
- `startDate` — ISO 8601 date string, applied as `admission_date >= $startDate`
- `endDate` — ISO 8601 date string, applied as `admission_date <= $endDate + 1 day`
- `departmentId` — integer, added as `AND department_id = $departmentId`

Parameters use **Drizzle's `sql` template tag** for safe parameterized queries (no string interpolation, no SQL injection risk).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS v4, shadcn/ui |
| Charts | Recharts |
| Data fetching | TanStack React Query (generated hooks) |
| Data table | TanStack React Table |
| CSV export | react-csv |
| Backend | Express.js 5, TypeScript, Node.js 24 |
| Validation | Zod (generated from OpenAPI spec) |
| API contract | OpenAPI 3.1, Orval codegen |
| ORM | Drizzle ORM |
| Database | PostgreSQL |

---

## Seed Data

`scripts/src/seed.ts` generates 18 months of realistic synthetic data (Jan 2024 – Jun 2025):
- **5 departments**: Psychiatry, Emergency, Outpatient Services, Addictions and Mental Health, Community Care
- **115 staff** members across all departments
- **300 patients** with realistic demographics
- **850 admissions** with varying length-of-stay by department type
- **1,200 appointments** with completed/cancelled/scheduled statuses

Run: `pnpm --filter @workspace/scripts run seed`

---

## Running Locally

```bash
pnpm install
pnpm --filter @workspace/db run push       # Apply schema
pnpm --filter @workspace/scripts run seed  # Seed data
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/hospital-dashboard run dev
```

---

## Resume Blurb

> **Hospital Operations Analytics Dashboard** | React, TypeScript, Express.js, PostgreSQL, Recharts
>
> Built a full-stack Business Intelligence dashboard to monitor hospital operational metrics across five clinical departments. Designed a normalized PostgreSQL schema (departments, patients, staff, beds, admissions, appointments) and implemented SQL aggregation queries for KPIs including bed occupancy rate, average length of stay, staff-to-patient ratio, and monthly admissions trends. Backend built with Express.js using an OpenAPI-first contract; frontend uses React Query hooks generated from the spec. Features include date range filtering, department filtering, interactive charts (area, bar, stacked bar, line), a paginated and sortable admissions report table, CSV export per chart, dark mode, and PDF export.
