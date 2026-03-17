/**
 * Analytics routes — Ontario Mental Health Services Intelligence Dashboard
 *
 * Each endpoint runs a real SQL aggregation against the services and
 * service_taxonomy tables. Filter parameters are applied consistently
 * across all endpoints so chart values stay in sync with the report table.
 */

import { Router } from "express";
import { db, servicesTable, serviceTaxonomyTable } from "@workspace/db";
import { sql, eq, and, isNotNull } from "drizzle-orm";

const router = Router();

// ── Shared filter builder ─────────────────────────────────────────────────────

function buildFilters(query: Record<string, string | undefined>) {
  const conditions = [];

  if (query.county) {
    conditions.push(eq(servicesTable.physicalCounty, query.county));
  }
  if (query.bilingual === "true") {
    conditions.push(eq(servicesTable.bilingualService, true));
  }
  if (query.lgbtq === "true") {
    conditions.push(eq(servicesTable.lgbtqSupport, true));
  }
  if (query.harmReduction === "true") {
    conditions.push(eq(servicesTable.harmReduction, true));
  }
  if (query.ageGroup) {
    conditions.push(eq(servicesTable.eligibilityAgeGroup, query.ageGroup));
  }
  if (query.gender) {
    conditions.push(eq(servicesTable.eligibilityByGender, query.gender));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

// Returns the taxonomy join condition for a parent category filter
function taxonomyJoinFilter(taxonomyTerm: string) {
  return sql`SPLIT_PART(${serviceTaxonomyTable.term}, ' - ', 1) = ${taxonomyTerm}`;
}

// ── GET /api/analytics/kpis ───────────────────────────────────────────────────

router.get("/analytics/kpis", async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const where = buildFilters(q);
    const taxonomyTerm = q.taxonomyTerm;

    const conditions = [];
    if (where) conditions.push(where);
    if (taxonomyTerm) {
      conditions.push(
        sql`${servicesTable.id} IN (
          SELECT service_id FROM service_taxonomy
          WHERE SPLIT_PART(term, ' - ', 1) = ${taxonomyTerm}
        )`
      );
    }

    const [row] = await db
      .select({
        totalServices: sql<number>`COUNT(*)::int`,
        totalCounties: sql<number>`COUNT(DISTINCT ${servicesTable.physicalCounty})::int`,
        bilingualServices: sql<number>`COUNT(*) FILTER (WHERE ${servicesTable.bilingualService})::int`,
        lgbtqServices: sql<number>`COUNT(*) FILTER (WHERE ${servicesTable.lgbtqSupport})::int`,
        harmReductionServices: sql<number>`COUNT(*) FILTER (WHERE ${servicesTable.harmReduction})::int`,
      })
      .from(servicesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/services-by-category ──────────────────────────────────
//
// Groups by the parent category (before " - ") so sub-types like
// "Mental Health and Substance Use Disorder Services - Adult" and
// "Mental Health and Substance Use Disorder Services - Youth" are merged.

router.get("/analytics/services-by-category", async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const where = buildFilters(q);
    const taxonomyTerm = q.taxonomyTerm;

    const parentCategory = sql<string>`SPLIT_PART(${serviceTaxonomyTable.term}, ' - ', 1)`;

    const conditions = [];
    if (where) conditions.push(where);
    if (taxonomyTerm) conditions.push(taxonomyJoinFilter(taxonomyTerm));

    const rows = await db
      .select({
        category: parentCategory,
        count: sql<number>`COUNT(DISTINCT ${servicesTable.id})::int`,
      })
      .from(serviceTaxonomyTable)
      .innerJoin(servicesTable, eq(servicesTable.id, serviceTaxonomyTable.serviceId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(parentCategory)
      .orderBy(sql`COUNT(DISTINCT ${servicesTable.id}) DESC`)
      .limit(12);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/services-by-county ────────────────────────────────────

router.get("/analytics/services-by-county", async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const where = buildFilters(q);
    const taxonomyTerm = q.taxonomyTerm;

    const baseConditions = [isNotNull(servicesTable.physicalCounty)];
    if (where) baseConditions.push(where);

    let baseQuery;

    if (taxonomyTerm) {
      baseQuery = db
        .select({
          county: servicesTable.physicalCounty,
          count: sql<number>`COUNT(DISTINCT ${servicesTable.id})::int`,
        })
        .from(servicesTable)
        .innerJoin(
          serviceTaxonomyTable,
          and(
            eq(serviceTaxonomyTable.serviceId, servicesTable.id),
            taxonomyJoinFilter(taxonomyTerm)
          )
        )
        .where(and(...baseConditions))
        .$dynamic();
    } else {
      baseQuery = db
        .select({
          county: servicesTable.physicalCounty,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(servicesTable)
        .where(and(...baseConditions))
        .$dynamic();
    }

    const rows = await baseQuery
      .groupBy(servicesTable.physicalCounty)
      .orderBy(sql`2 DESC`)
      .limit(20);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/eligibility-by-age ────────────────────────────────────

router.get("/analytics/eligibility-by-age", async (req, res, next) => {
  try {
    const baseFilters = buildFilters(req.query as Record<string, string>);
    const conditions = [isNotNull(servicesTable.eligibilityAgeGroup)];
    if (baseFilters) conditions.push(baseFilters);

    const rows = await db
      .select({
        ageGroup: servicesTable.eligibilityAgeGroup,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(servicesTable)
      .where(and(...conditions))
      .groupBy(servicesTable.eligibilityAgeGroup)
      .orderBy(sql`COUNT(*)::int DESC`);

    res.json(rows.map(r => ({ ageGroup: r.ageGroup ?? "", count: r.count })));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/eligibility-by-gender ─────────────────────────────────

router.get("/analytics/eligibility-by-gender", async (req, res, next) => {
  try {
    const baseFilters = buildFilters(req.query as Record<string, string>);
    const conditions = [isNotNull(servicesTable.eligibilityByGender)];
    if (baseFilters) conditions.push(baseFilters);

    const rows = await db
      .select({
        gender: servicesTable.eligibilityByGender,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(servicesTable)
      .where(and(...conditions))
      .groupBy(servicesTable.eligibilityByGender)
      .orderBy(sql`COUNT(*)::int DESC`);

    res.json(rows.map(r => ({ gender: r.gender ?? "", count: r.count })));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/language-distribution ─────────────────────────────────

router.get("/analytics/language-distribution", async (req, res, next) => {
  try {
    const baseFilters = buildFilters(req.query as Record<string, string>);

    const rows = await db
      .select({
        language: sql<string>`
          CASE
            WHEN ${servicesTable.bilingualService} THEN 'Bilingual (EN/FR)'
            WHEN ${servicesTable.languagesOfferedList} ILIKE '%français%'
              OR ${servicesTable.languagesOfferedList} ILIKE '%french%'
            THEN 'French Only'
            ELSE 'English Only'
          END
        `,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(servicesTable)
      .where(baseFilters)
      .groupBy(sql`1`)
      .orderBy(sql`COUNT(*)::int DESC`);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/services-report ───────────────────────────────────────

router.get("/analytics/services-report", async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const where = buildFilters(q);
    const search = q.search?.trim();
    const taxonomyTerm = q.taxonomyTerm;

    const conditions = [];
    if (where) conditions.push(where);
    if (search) {
      conditions.push(
        sql`(${servicesTable.publicName} ILIKE ${'%' + search + '%'} OR ${servicesTable.officialName} ILIKE ${'%' + search + '%'})`
      );
    }

    let baseQuery;

    if (taxonomyTerm) {
      baseQuery = db
        .select({
          id: servicesTable.id,
          publicName: servicesTable.publicName,
          officialName: servicesTable.officialName,
          category: sql<string>`string_agg(DISTINCT ${serviceTaxonomyTable.term}, ', ')`,
          physicalCity: servicesTable.physicalCity,
          physicalCounty: servicesTable.physicalCounty,
          eligibilityByAge: servicesTable.eligibilityByAge,
          eligibilityAgeGroup: servicesTable.eligibilityAgeGroup,
          eligibilityByGender: servicesTable.eligibilityByGender,
          languagesOfferedList: servicesTable.languagesOfferedList,
          bilingualService: servicesTable.bilingualService,
          lgbtqSupport: servicesTable.lgbtqSupport,
          harmReduction: servicesTable.harmReduction,
          normalWaitTime: servicesTable.normalWaitTime,
          websiteAddress: servicesTable.websiteAddress,
        })
        .from(servicesTable)
        .innerJoin(
          serviceTaxonomyTable,
          and(
            eq(serviceTaxonomyTable.serviceId, servicesTable.id),
            taxonomyJoinFilter(taxonomyTerm)
          )
        )
        .$dynamic();
    } else {
      baseQuery = db
        .select({
          id: servicesTable.id,
          publicName: servicesTable.publicName,
          officialName: servicesTable.officialName,
          category: sql<string>`string_agg(DISTINCT ${serviceTaxonomyTable.term}, ', ')`,
          physicalCity: servicesTable.physicalCity,
          physicalCounty: servicesTable.physicalCounty,
          eligibilityByAge: servicesTable.eligibilityByAge,
          eligibilityAgeGroup: servicesTable.eligibilityAgeGroup,
          eligibilityByGender: servicesTable.eligibilityByGender,
          languagesOfferedList: servicesTable.languagesOfferedList,
          bilingualService: servicesTable.bilingualService,
          lgbtqSupport: servicesTable.lgbtqSupport,
          harmReduction: servicesTable.harmReduction,
          normalWaitTime: servicesTable.normalWaitTime,
          websiteAddress: servicesTable.websiteAddress,
        })
        .from(servicesTable)
        .leftJoin(serviceTaxonomyTable, eq(serviceTaxonomyTable.serviceId, servicesTable.id))
        .$dynamic();
    }

    const rows = await baseQuery
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(servicesTable.id)
      .orderBy(servicesTable.publicName);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
