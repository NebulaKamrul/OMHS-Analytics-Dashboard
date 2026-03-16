/**
 * Filter option routes — returns distinct values to populate dropdowns
 */

import { Router } from "express";
import { db, servicesTable, serviceTaxonomyTable } from "@workspace/db";
import { sql, isNotNull, asc } from "drizzle-orm";

const router = Router();

// GET /api/filters/counties
router.get("/filters/counties", async (req, res, next) => {
  try {
    const rows = await db
      .selectDistinct({ county: servicesTable.physicalCounty })
      .from(servicesTable)
      .where(isNotNull(servicesTable.physicalCounty))
      .orderBy(asc(servicesTable.physicalCounty));

    res.json(rows.map(r => r.county).filter(Boolean));
  } catch (err) {
    next(err);
  }
});

// GET /api/filters/taxonomy-terms
// Returns distinct PARENT categories (strips sub-type after " - ") so the
// dropdown shows clean top-level category names like
// "Mental Health and Substance Use Disorder Services" instead of
// "Mental Health and Substance Use Disorder Services - Adult Treatment".
router.get("/filters/taxonomy-terms", async (req, res, next) => {
  try {
    const rows = await db
      .selectDistinct({
        term: sql<string>`SPLIT_PART(${serviceTaxonomyTable.term}, ' - ', 1)`,
      })
      .from(serviceTaxonomyTable)
      .orderBy(sql`SPLIT_PART(${serviceTaxonomyTable.term}, ' - ', 1) ASC`);

    res.json(rows.map(r => r.term).filter(Boolean));
  } catch (err) {
    next(err);
  }
});

export default router;
