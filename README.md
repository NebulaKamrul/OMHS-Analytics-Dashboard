# Ontario Mental Health Services Intelligence Dashboard

Built a full-stack mental health dashboard using real Ontario service data (~6,000 records).

This project takes messy, real-world Excel data and turns it into something usable — with a database, API, and interactive dashboard for exploring services by location, category, and eligibility.

Live demo: https://ontariomhd.replit.app/

---

## What I focused on

- Turning messy real-world data into structured, usable insights  
- Building end-to-end systems (data → database → API → frontend)  
- Making complex information easy to explore through filters and visualizations  

---

## Architecture

```
Excel file (.xlsx)
    │
    ▼
Import script (scripts/src/import_services.ts)
    │  Reads and transforms 5,945 rows
    │  Normalizes free-text fields to booleans
    │  Derives age groups from semicolon-delimited age lists
    │  Splits taxonomy terms into separate normalized rows
    ▼
PostgreSQL (Drizzle ORM)
    ├── services         (5,945 rows)
    └── service_taxonomy (10,265 rows — normalized terms)
         │
         ▼
Express.js API (artifacts/api-server/)
    │  OpenAPI 3.1 spec → orval codegen → typed React Query hooks
    │  Every chart endpoint runs a real SQL GROUP BY aggregation
    │  Filter parameters applied consistently across all endpoints
         │
         ▼
React + Vite Dashboard (artifacts/hospital-dashboard/)
    ├── KPI cards        — total services, counties, bilingual, LGBTQ+, harm reduction
    ├── Bar chart        — services by taxonomy category (top 15)
    ├── Bar chart        — services by Ontario county (top 20)
    ├── Bar chart        — eligibility by age group (derived)
    ├── Pie chart        — gender eligibility distribution
    ├── Pie chart        — language availability (EN / FR / Bilingual)
    └── Report table     — searchable, filterable, CSV exportable
```

---

## Data Source

**File:** `khp_2019_moh_export_open_data_updated.xlsx`
**Source:** Kids Help Phone — Ontario Ministry of Health, 2019
**Records:** 5,945 rows, 140+ columns
**Coverage:** Mental health, addiction, and crisis services across Ontario

---

## Database Schema

### `services`

One row per service record. Core analytics table.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `resource_agency_num` | text | Source agency identifier |
| `public_name` | text | Public-facing service name |
| `official_name` | text | Official registered name |
| `taxonomy_level` | text | Record type (Agency, Site, Program, ProgramAtSite) |
| `agency_status` | text | Active / Active but do not refer |
| `agency_description` | text | HTML-stripped description |
| `website_address` | text | Service website URL |
| `bilingual_service` | boolean | **Derived:** true if "Bilingual" or "Bilingue" in source |
| `lgbtq_support` | boolean | **Derived:** true if "Yes" or "Oui" |
| `harm_reduction` | boolean | **Derived:** true if "Yes" or "Oui" |
| `eligibility_age_group` | text | **Derived:** classified age group from age list |
| `eligibility_by_gender` | text | **Normalized:** Female Only / Male Only / All Genders |
| `physical_city` | text | Physical location city |
| `physical_county` | text | Ontario county |
| `latitude` / `longitude` | numeric | GPS coordinates |

### `service_taxonomy`

Normalized taxonomy terms. One row per (service, term) pair.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `service_id` | integer | Foreign key → services(id) |
| `term` | text | Individual taxonomy term |

The source `TaxonomyTerms` field is semicolon-delimited. Normalizing into rows enables clean `GROUP BY term` aggregations without string-splitting in SQL.

---

## Import Pipeline

```bash
pnpm --filter @workspace/scripts run import
```

1. Reads Excel file using `xlsx` library
2. Iterates rows in batches of 200
3. Applies field transformations:
   - `bilingual_service` ← contains "Bilingual" or "Bilingue" → `true`
   - `lgbtq_support` ← "Yes" or "Oui" → `true`
   - `harm_reduction` ← "Yes" or "Oui" → `true`
   - `eligibility_by_gender` ← normalizes French/English variants
   - `eligibility_age_group` ← parses semicolon age list → min/max classification
   - `agency_description` ← HTML stripped
4. Inserts services, then splits taxonomy terms into `service_taxonomy`

**Excluded columns:** Phone numbers (10 phone fields), contact staff details, IRS/legal/financial fields, `SearchHints`, raw address lines.

---

## Dashboard KPIs

| KPI | SQL | Result |
|-----|-----|--------|
| Total Services | `COUNT(*)` | 5,945 |
| Counties | `COUNT(DISTINCT physical_county)` | 50 |
| Bilingual Services | `COUNT(*) FILTER (WHERE bilingual_service)` | 266 |
| LGBTQ+ Affirming | `COUNT(*) FILTER (WHERE lgbtq_support)` | 248 |
| Harm Reduction | `COUNT(*) FILTER (WHERE harm_reduction)` | 6 |

---

## Key SQL Queries

All queries are documented in `analytics_queries.sql`.

```sql
-- Services by category (top 15)
SELECT st.term AS category, COUNT(DISTINCT s.id) AS count
FROM service_taxonomy st
JOIN services s ON s.id = st.service_id
GROUP BY st.term ORDER BY count DESC LIMIT 15;

-- Services by county (top 20)
SELECT physical_county, COUNT(*) AS count
FROM services WHERE physical_county IS NOT NULL
GROUP BY physical_county ORDER BY count DESC LIMIT 20;

-- Age eligibility distribution
SELECT eligibility_age_group, COUNT(*) AS count
FROM services WHERE eligibility_age_group IS NOT NULL
GROUP BY eligibility_age_group ORDER BY count DESC;
```

---

## How Filters Work

All chart and report endpoints accept the same filter parameters:

| Parameter | Applied as |
|-----------|-----------|
| `county` | `WHERE physical_county = $county` |
| `taxonomyTerm` | `JOIN service_taxonomy WHERE term = $term` |
| `bilingual` | `WHERE bilingual_service = true` |
| `lgbtq` | `WHERE lgbtq_support = true` |
| `harmReduction` | `WHERE harm_reduction = true` |
| `ageGroup` | `WHERE eligibility_age_group = $ageGroup` |
| `gender` | `WHERE eligibility_by_gender = $gender` |

All chart panels stay in sync because they share the same filter conditions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Recharts |
| Styling | Tailwind CSS v4 with CSS custom property design tokens |
| API client | Orval (OpenAPI → React Query codegen) |
| Backend | Express.js, TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Data import | xlsx, Node.js |
| API contract | OpenAPI 3.1 (`lib/api-spec/openapi.yaml`) |

---

## Running Locally

```bash
pnpm install
pnpm --filter @workspace/db run push-force
pnpm --filter @workspace/scripts run import
pnpm --filter @workspace/api-server run dev   # port 8080
pnpm --filter @workspace/hospital-dashboard run dev
```

Requires `DATABASE_URL` environment variable.

---

## Resume Bullet Points

- **Designed and implemented a full-stack BI dashboard** for 5,945 real Ontario mental health service records (KHP 2019 MOH Export), covering data ingestion from Excel, normalization into a relational PostgreSQL schema, REST API layer with OpenAPI codegen, and a filterable React dashboard with five chart types and CSV export.

- **Built a reproducible ETL pipeline** that cleans messy real-world Excel data, normalizes free-text bilingual/LGBTQ/gender eligibility fields to structured booleans, derives age eligibility groups from semicolon-delimited age lists, and loads 10,000+ normalized taxonomy rows via batched PostgreSQL inserts using Drizzle ORM.

- **Architected a SQL-backed analytics API** with filter-consistent GROUP BY aggregation endpoints (taxonomy, geography, eligibility, language distribution), an OpenAPI 3.1 spec, and orval-generated TypeScript React Query hooks, demonstrating end-to-end type safety from database schema to UI component.
