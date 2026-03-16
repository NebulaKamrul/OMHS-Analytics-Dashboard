import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

// Parse shared query params from request
function parseFilters(query: Record<string, unknown>) {
  const startDate = typeof query.startDate === "string" ? query.startDate : null;
  const endDate = typeof query.endDate === "string" ? query.endDate : null;
  const departmentId = typeof query.departmentId === "string" ? parseInt(query.departmentId, 10) : null;
  return { startDate, endDate, departmentId };
}

/**
 * GET /api/dashboard/kpis
 *
 * Returns top-level KPI metrics:
 *   - Total admissions in the period
 *   - Average length of stay (days) for discharged patients
 *   - Bed occupancy rate (occupied / total beds)
 *   - Staff-to-patient ratio (staff / admitted patients)
 *   - Total discharges
 *   - Total appointments
 */
router.get("/dashboard/kpis", async (req, res): Promise<void> => {
  const { startDate, endDate, departmentId } = parseFilters(req.query as Record<string, unknown>);

  const kpiRes = await db.execute(sql`
    SELECT
      COUNT(DISTINCT a.id)::int                                       AS "totalAdmissions",
      ROUND(
        AVG(
          CASE
            WHEN a.discharge_date IS NOT NULL
            THEN EXTRACT(EPOCH FROM (a.discharge_date - a.admission_date)) / 86400.0
          END
        )::numeric, 2
      )::float                                                        AS "avgLengthOfStay",
      ROUND(
        100.0 * SUM(CASE WHEN a.status = 'admitted' THEN 1 ELSE 0 END)::numeric
          / NULLIF((SELECT SUM(total_beds) FROM departments
                    ${departmentId ? sql`WHERE id = ${departmentId}` : sql``}), 0),
        1
      )::float                                                        AS "bedOccupancyRate",
      ROUND(
        (SELECT COUNT(*) FROM staff
         ${departmentId ? sql`WHERE department_id = ${departmentId}` : sql``})::numeric
          / NULLIF(SUM(CASE WHEN a.status = 'admitted' THEN 1 ELSE 0 END), 0),
        2
      )::float                                                        AS "staffPatientRatio",
      COUNT(CASE WHEN a.status = 'discharged' THEN 1 END)::int       AS "totalDischarges",
      (
        SELECT COUNT(*)::int FROM appointments ap
        WHERE 1=1
          ${startDate ? sql`AND ap.scheduled_at >= ${startDate}::timestamptz` : sql``}
          ${endDate ? sql`AND ap.scheduled_at <= ${endDate}::timestamptz + INTERVAL '1 day'` : sql``}
          ${departmentId ? sql`AND ap.department_id = ${departmentId}` : sql``}
      )                                                               AS "totalAppointments"
    FROM admissions a
    WHERE 1=1
      ${startDate ? sql`AND a.admission_date >= ${startDate}::timestamptz` : sql``}
      ${endDate ? sql`AND a.admission_date <= ${endDate}::timestamptz + INTERVAL '1 day'` : sql``}
      ${departmentId ? sql`AND a.department_id = ${departmentId}` : sql``}
  `);
  const kpiResult = kpiRes.rows[0];

  res.json({
    totalAdmissions: Number(kpiResult?.totalAdmissions ?? 0),
    avgLengthOfStay: Number(kpiResult?.avgLengthOfStay ?? 0),
    bedOccupancyRate: Number(kpiResult?.bedOccupancyRate ?? 0),
    staffPatientRatio: Number(kpiResult?.staffPatientRatio ?? 0),
    totalDischarges: Number(kpiResult?.totalDischarges ?? 0),
    totalAppointments: Number(kpiResult?.totalAppointments ?? 0),
  });
});

/**
 * GET /api/dashboard/admissions-by-month
 *
 * Monthly admissions count (YYYY-MM) for trend chart.
 * SQL: GROUP BY date_trunc('month', admission_date) with optional filters.
 */
router.get("/dashboard/admissions-by-month", async (req, res): Promise<void> => {
  const { startDate, endDate, departmentId } = parseFilters(req.query as Record<string, unknown>);

  const { rows } = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', a.admission_date), 'YYYY-MM') AS month,
      COUNT(*)::int                                               AS admissions
    FROM admissions a
    WHERE 1=1
      ${startDate ? sql`AND a.admission_date >= ${startDate}::timestamptz` : sql``}
      ${endDate ? sql`AND a.admission_date <= ${endDate}::timestamptz + INTERVAL '1 day'` : sql``}
      ${departmentId ? sql`AND a.department_id = ${departmentId}` : sql``}
    GROUP BY DATE_TRUNC('month', a.admission_date)
    ORDER BY DATE_TRUNC('month', a.admission_date)
  `);

  res.json(rows.map((r) => ({ month: r.month as string, admissions: Number(r.admissions) })));
});

/**
 * GET /api/dashboard/appointments-by-department
 *
 * Total, completed, and cancelled appointments grouped by department.
 * SQL: LEFT JOIN departments + GROUP BY department, status breakdown via CASE.
 */
router.get("/dashboard/appointments-by-department", async (req, res): Promise<void> => {
  const { startDate, endDate, departmentId } = parseFilters(req.query as Record<string, unknown>);

  const { rows } = await db.execute(sql`
    SELECT
      d.name                                                               AS department,
      COUNT(ap.id)::int                                                    AS appointments,
      COUNT(CASE WHEN ap.status = 'completed' THEN 1 END)::int            AS completed,
      COUNT(CASE WHEN ap.status = 'cancelled' THEN 1 END)::int            AS cancelled
    FROM appointments ap
    JOIN departments d ON ap.department_id = d.id
    WHERE 1=1
      ${startDate ? sql`AND ap.scheduled_at >= ${startDate}::timestamptz` : sql``}
      ${endDate ? sql`AND ap.scheduled_at <= ${endDate}::timestamptz + INTERVAL '1 day'` : sql``}
      ${departmentId ? sql`AND ap.department_id = ${departmentId}` : sql``}
    GROUP BY d.id, d.name
    ORDER BY COUNT(ap.id) DESC
  `);

  res.json(rows.map((r) => ({
    department: r.department as string,
    appointments: Number(r.appointments),
    completed: Number(r.completed),
    cancelled: Number(r.cancelled),
  })));
});

/**
 * GET /api/dashboard/occupancy-by-department
 *
 * Bed occupancy rate per department.
 * SQL: admitted admissions / total_beds in each department.
 */
router.get("/dashboard/occupancy-by-department", async (req, res): Promise<void> => {
  const { startDate, endDate, departmentId } = parseFilters(req.query as Record<string, unknown>);

  const { rows } = await db.execute(sql`
    SELECT
      d.name                                                                 AS department,
      d.total_beds                                                           AS "totalBeds",
      COUNT(CASE WHEN a.status = 'admitted' THEN 1 END)::int                AS "occupiedBeds",
      ROUND(
        100.0 * COUNT(CASE WHEN a.status = 'admitted' THEN 1 END)::numeric
          / NULLIF(d.total_beds, 0),
        1
      )::float                                                               AS "occupancyRate"
    FROM departments d
    LEFT JOIN admissions a
      ON a.department_id = d.id
      ${startDate ? sql`AND a.admission_date >= ${startDate}::timestamptz` : sql``}
      ${endDate ? sql`AND a.admission_date <= ${endDate}::timestamptz + INTERVAL '1 day'` : sql``}
    WHERE 1=1
      ${departmentId ? sql`AND d.id = ${departmentId}` : sql``}
    GROUP BY d.id, d.name, d.total_beds
    ORDER BY "occupancyRate" DESC
  `);

  res.json(rows.map((r) => ({
    department: r.department as string,
    totalBeds: Number(r.totalBeds),
    occupiedBeds: Number(r.occupiedBeds),
    occupancyRate: Number(r.occupancyRate),
  })));
});

/**
 * GET /api/dashboard/avg-length-of-stay
 *
 * Average patient length of stay in days, by department.
 * SQL: AVG(EXTRACT(EPOCH FROM discharge_date - admission_date) / 86400) for discharged patients.
 */
router.get("/dashboard/avg-length-of-stay", async (req, res): Promise<void> => {
  const { startDate, endDate, departmentId } = parseFilters(req.query as Record<string, unknown>);

  const { rows } = await db.execute(sql`
    SELECT
      d.name                                                  AS department,
      ROUND(
        AVG(
          EXTRACT(EPOCH FROM (a.discharge_date - a.admission_date)) / 86400.0
        )::numeric,
        1
      )::float                                                AS "avgDays"
    FROM admissions a
    JOIN departments d ON a.department_id = d.id
    WHERE a.discharge_date IS NOT NULL
      ${startDate ? sql`AND a.admission_date >= ${startDate}::timestamptz` : sql``}
      ${endDate ? sql`AND a.admission_date <= ${endDate}::timestamptz + INTERVAL '1 day'` : sql``}
      ${departmentId ? sql`AND a.department_id = ${departmentId}` : sql``}
    GROUP BY d.id, d.name
    ORDER BY "avgDays" DESC
  `);

  res.json(rows.map((r) => ({
    department: r.department as string,
    avgDays: Number(r.avgDays),
  })));
});

/**
 * GET /api/dashboard/discharge-trends
 *
 * Weekly discharge counts for trend chart.
 * SQL: GROUP BY date_trunc('week', discharge_date).
 */
router.get("/dashboard/discharge-trends", async (req, res): Promise<void> => {
  const { startDate, endDate, departmentId } = parseFilters(req.query as Record<string, unknown>);

  const { rows } = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('week', a.discharge_date), 'YYYY-MM-DD') AS week,
      COUNT(*)::int                                                 AS discharges
    FROM admissions a
    WHERE a.discharge_date IS NOT NULL
      AND a.status = 'discharged'
      ${startDate ? sql`AND a.discharge_date >= ${startDate}::timestamptz` : sql``}
      ${endDate ? sql`AND a.discharge_date <= ${endDate}::timestamptz + INTERVAL '1 day'` : sql``}
      ${departmentId ? sql`AND a.department_id = ${departmentId}` : sql``}
    GROUP BY DATE_TRUNC('week', a.discharge_date)
    ORDER BY DATE_TRUNC('week', a.discharge_date)
  `);

  res.json(rows.map((r) => ({ week: r.week as string, discharges: Number(r.discharges) })));
});

/**
 * GET /api/dashboard/report
 *
 * Full admissions report table with patient and department details.
 * SQL: JOIN patients and departments, ordered by admission_date DESC.
 */
router.get("/dashboard/report", async (req, res): Promise<void> => {
  const { startDate, endDate, departmentId } = parseFilters(req.query as Record<string, unknown>);

  const { rows } = await db.execute(sql`
    SELECT
      a.id                                                                   AS "admissionId",
      p.first_name || ' ' || p.last_name                                     AS "patientName",
      d.name                                                                 AS department,
      TO_CHAR(a.admission_date AT TIME ZONE 'UTC', 'YYYY-MM-DD')            AS "admissionDate",
      CASE
        WHEN a.discharge_date IS NOT NULL
        THEN TO_CHAR(a.discharge_date AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      END                                                                    AS "dischargeDate",
      CASE
        WHEN a.discharge_date IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (a.discharge_date - a.admission_date)) / 86400.0)::int
      END                                                                    AS "lengthOfStay",
      a.status                                                               AS status
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    JOIN departments d ON a.department_id = d.id
    WHERE 1=1
      ${startDate ? sql`AND a.admission_date >= ${startDate}::timestamptz` : sql``}
      ${endDate ? sql`AND a.admission_date <= ${endDate}::timestamptz + INTERVAL '1 day'` : sql``}
      ${departmentId ? sql`AND a.department_id = ${departmentId}` : sql``}
    ORDER BY a.admission_date DESC
    LIMIT 500
  `);

  res.json(rows.map((r) => ({
    admissionId: Number(r.admissionId),
    patientName: r.patientName as string,
    department: r.department as string,
    admissionDate: r.admissionDate as string,
    dischargeDate: (r.dischargeDate as string | null) ?? null,
    lengthOfStay: r.lengthOfStay != null ? Number(r.lengthOfStay) : null,
    status: r.status as string,
  })));
});

export default router;
