import { Router, type IRouter } from "express";
import { db, departmentsTable } from "@workspace/db";

const router: IRouter = Router();

/**
 * GET /api/departments
 *
 * Returns all departments for use in filter dropdowns.
 */
router.get("/departments", async (_req, res): Promise<void> => {
  const departments = await db
    .select({
      id: departmentsTable.id,
      name: departmentsTable.name,
      code: departmentsTable.code,
      totalBeds: departmentsTable.totalBeds,
      staffCount: departmentsTable.staffCount,
    })
    .from(departmentsTable)
    .orderBy(departmentsTable.name);

  res.json(departments);
});

export default router;
