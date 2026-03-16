/**
 * Filter option routes — returns distinct values to populate dropdowns
 */

import { Router } from "express";
import { db, servicesTable, serviceTaxonomyTable } from "@workspace/db";
import { sql, isNotNull, asc } from "drizzle-orm";

const router = Router();

// GET /api/filters/counties — distinct Ontario counties with service counts
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

// GET /api/filters/taxonomy-terms — distinct taxonomy terms sorted by name
router.get("/filters/taxonomy-terms", async (req, res, next) => {
  try {
    const rows = await db
      .selectDistinct({ term: serviceTaxonomyTable.term })
      .from(serviceTaxonomyTable)
      .orderBy(asc(serviceTaxonomyTable.term));

    res.json(rows.map(r => r.term).filter(Boolean));
  } catch (err) {
    next(err);
  }
});

export default router;
