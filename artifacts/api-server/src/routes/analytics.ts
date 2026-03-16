/**
 * Analytics routes — Ontario Mental Health Services Intelligence Dashboard
 *
 * Each endpoint runs a real SQL aggregation against the services and
 * service_taxonomy tables. Filter parameters are applied consistently
 * across all endpoints so chart values stay in sync with the report table.
 *
 * analytics_queries.sql contains the equivalent raw SQL for reference.
 */

import { Router } from "express";
import { db, servicesTable, serviceTaxonomyTable } from "@workspace/db";
import { sql, eq, and, isNotNull, ilike } from "drizzle-orm";

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

// ── GET /api/analytics/kpis ───────────────────────────────────────────────────
//
// SELECT
//   COUNT(*)                                      AS total_services,
//   COUNT(DISTINCT physical_county)               AS total_counties,
//   COUNT(*) FILTER (WHERE bilingual_service)     AS bilingual_services,
//   COUNT(*) FILTER (WHERE lgbtq_support)         AS lgbtq_services,
//   COUNT(*) FILTER (WHERE harm_reduction)        AS harm_reduction_services
// FROM services
// WHERE <filters>;

router.get("/analytics/kpis", async (req, res, next) => {
  try {
    const where = buildFilters(req.query as Record<string, string>);

    const [row] = await db
      .select({
        totalServices: sql<number>`COUNT(*)::int`,
        totalCounties: sql<number>`COUNT(DISTINCT ${servicesTable.physicalCounty})::int`,
        bilingualServices: sql<number>`COUNT(*) FILTER (WHERE ${servicesTable.bilingualService})::int`,
        lgbtqServices: sql<number>`COUNT(*) FILTER (WHERE ${servicesTable.lgbtqSupport})::int`,
        harmReductionServices: sql<number>`COUNT(*) FILTER (WHERE ${servicesTable.harmReduction})::int`,
      })
      .from(servicesTable)
      .where(where);

    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/services-by-category ──────────────────────────────────
//
// SELECT st.term AS category, COUNT(DISTINCT s.id) AS count
// FROM service_taxonomy st
// JOIN services s ON s.id = st.service_id
// WHERE <filters>
// GROUP BY st.term
// ORDER BY count DESC
// LIMIT 15;

router.get("/analytics/services-by-category", async (req, res, next) => {
  try {
    const where = buildFilters(req.query as Record<string, string>);
    const taxonomyTerm = (req.query as Record<string, string>).taxonomyTerm;

    let query = db
      .select({
        category: serviceTaxonomyTable.term,
        count: sql<number>`COUNT(DISTINCT ${servicesTable.id})::int`,
      })
      .from(serviceTaxonomyTable)
      .innerJoin(servicesTable, eq(servicesTable.id, serviceTaxonomyTable.serviceId))
      .$dynamic();

    if (where || taxonomyTerm) {
      const allConditions = [];
      if (where) allConditions.push(where);
      query = query.where(allConditions.length > 0 ? and(...allConditions) : undefined);
    }

    const rows = await query
      .groupBy(serviceTaxonomyTable.term)
      .orderBy(sql`COUNT(DISTINCT ${servicesTable.id}) DESC`)
      .limit(15);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/services-by-county ────────────────────────────────────
//
// SELECT physical_county AS county, COUNT(*) AS count
// FROM services
// WHERE physical_county IS NOT NULL AND <filters>
// GROUP BY physical_county
// ORDER BY count DESC
// LIMIT 20;

router.get("/analytics/services-by-county", async (req, res, next) => {
  try {
    const where = buildFilters(req.query as Record<string, string>);
    const taxonomyTerm = (req.query as Record<string, string>).taxonomyTerm;

    let baseQuery = db
      .select({
        county: servicesTable.physicalCounty,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(servicesTable)
      .$dynamic();

    if (taxonomyTerm) {
      baseQuery = db
        .select({
          county: servicesTable.physicalCounty,
          count: sql<number>`COUNT(DISTINCT ${servicesTable.id})::int`,
        })
        .from(servicesTable)
        .innerJoin(serviceTaxonomyTable, and(
          eq(serviceTaxonomyTable.serviceId, servicesTable.id),
          eq(serviceTaxonomyTable.term, taxonomyTerm)
        ))
        .$dynamic();
    }

    const baseConditions = [isNotNull(servicesTable.physicalCounty)];
    if (where) baseConditions.push(where);

    const rows = await baseQuery
      .where(and(...baseConditions))
      .groupBy(servicesTable.physicalCounty)
      .orderBy(sql`COUNT(*)::int DESC`)
      .limit(20);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analytics/eligibility-by-age ────────────────────────────────────
//
// SELECT eligibility_age_group AS age_group, COUNT(*) AS count
// FROM services
// WHERE eligibility_age_group IS NOT NULL AND <filters>
// GROUP BY eligibility_age_group
// ORDER BY count DESC;

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
//
// SELECT eligibility_by_gender AS gender, COUNT(*) AS count
// FROM services
// WHERE eligibility_by_gender IS NOT NULL AND <filters>
// GROUP BY eligibility_by_gender
// ORDER BY count DESC;

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
//
// SELECT
//   CASE
//     WHEN bilingual_service THEN 'Bilingual (EN/FR)'
//     WHEN languages_offered_list ILIKE '%français%' OR languages_offered_list ILIKE '%french%'
//          THEN 'French Only'
//     ELSE 'English Only'
//   END AS language,
//   COUNT(*) AS count
// FROM services
// GROUP BY 1
// ORDER BY count DESC;

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
//
// SELECT s.id, s.public_name, s.official_name,
//        string_agg(DISTINCT st.term, ', ') AS category,
//        s.physical_city, s.physical_county,
//        s.eligibility_by_age, s.eligibility_age_group, s.eligibility_by_gender,
//        s.languages_offered_list, s.bilingual_service, s.lgbtq_support,
//        s.harm_reduction, s.normal_wait_time, s.website_address
// FROM services s
// LEFT JOIN service_taxonomy st ON st.service_id = s.id
// WHERE <filters>
// GROUP BY s.id
// ORDER BY s.public_name
// LIMIT 500;

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

    let baseQuery = db
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
            eq(serviceTaxonomyTable.term, taxonomyTerm)
          )
        )
        .$dynamic();
    }

    const rows = await baseQuery
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(servicesTable.id)
      .orderBy(servicesTable.publicName)
      .limit(500);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
