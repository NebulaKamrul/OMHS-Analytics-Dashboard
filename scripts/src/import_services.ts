/**
 * Ontario Mental Health Services — Data Import Script
 *
 * Source: KHP 2019 MOH Export (khp_2019_moh_export_open_data_updated.xlsx)
 *
 * Pipeline:
 *   Excel file → parse + clean → PostgreSQL (services + service_taxonomy)
 *
 * Transformations applied:
 *   - bilingual_service:  "Bilingual" in Custom_Is this a bilingual service? → true
 *   - lgbtq_support:      "Yes" or "Oui" → true
 *   - harm_reduction:     "Yes" or "Oui" → true
 *   - eligibility_by_gender: normalized to "Female Only" / "Male Only" / "All Genders"
 *   - eligibility_age_group: derived from Custom_Eligibility by Age semicolon list
 *       using min/max age to classify into broad groups
 *   - TaxonomyTerms field split on ";" → one row per term in service_taxonomy table
 *   - HTML stripped from AgencyDescription
 *
 * Columns excluded (not used in analytics):
 *   - All phone number fields (Phone1-5, Fax, TTY, TollFree, etc.)
 *   - Senior worker and main contact info
 *   - IRS / legal / financial fields
 *   - SearchHints, ExcludeFromWebsite, ExcludeFromDirectory
 *   - Raw address line 1/2 (city, county, postal code kept)
 *
 * Run: pnpm --filter @workspace/scripts run import
 */

import * as path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { db } from "@workspace/db";
import { servicesTable, serviceTaxonomyTable } from "@workspace/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = path.resolve(__dirname, "../../attached_assets/khp_2019_moh_export_open_data_updated_1773689392425.xlsx");

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return String(html).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null;
}

/**
 * Normalize bilingual field to boolean.
 * Source values include: "Bilingual - both French and English", "English only",
 * "Français seulement", "Bilingue - Français et Anglais", etc.
 */
function normalizeBilingual(val: string | null): boolean {
  if (!val) return false;
  const v = String(val).toLowerCase();
  return v.includes("bilingual") || v.includes("bilingue");
}

/**
 * Normalize LGBTQ and harm reduction flags to boolean.
 * Source values: "Yes", "Oui", "No ", "Non", null
 */
function normalizeYesNo(val: string | null): boolean {
  if (!val) return false;
  const v = String(val).trim().toLowerCase();
  return v === "yes" || v === "oui";
}

/**
 * Normalize gender eligibility to one of:
 *   "Female Only" | "Male Only" | "All Genders" | null
 *
 * Source values: "Females - only; Males - only", "Males - only",
 *   "Femmes/Filles - seulement; Hommes/Garçons - seulement", etc.
 */
function normalizeGender(val: string | null): string | null {
  if (!val) return null;
  const v = String(val).toLowerCase();
  const hasFemale = v.includes("female") || v.includes("femme") || v.includes("fille");
  const hasMale = v.includes("male") || v.includes("homme") || v.includes("garçon");
  if (hasFemale && hasMale) return "All Genders";
  if (hasFemale) return "Female Only";
  if (hasMale) return "Male Only";
  return null;
}

/**
 * Derive an age group from the semicolon-delimited Custom_Eligibility by Age field.
 *
 * Classification logic:
 *   1. Parse the list of age tokens (e.g. "14; 15; 16; 17")
 *   2. Convert to numeric range; "<5" → 4, ">25" → 26
 *   3. If min age ≤ 11 and max age ≤ 11       → "Children (0–11)"
 *   4. If min age ≤ 17 and max age ≤ 17       → "Adolescents (12–17)"
 *   5. If max age is 26 (">25") and min > 17  → "Adults (18+)"
 *   6. If range spans <5 to >25               → "All Ages"
 *   7. Otherwise                              → "Youth & Young Adults (12–25)"
 */
function deriveAgeGroup(val: string | null): string | null {
  if (!val) return null;
  const tokens = String(val).split(";").map(t => t.trim()).filter(Boolean);
  const nums = tokens.map(t => {
    if (t === "<5") return 4;
    if (t === ">25") return 26;
    const n = parseInt(t, 10);
    return isNaN(n) ? null : n;
  }).filter((n): n is number => n !== null);
  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max <= 11) return "Children (0–11)";
  if (min >= 18 || (min >= 12 && max <= 17)) return "Adolescents (12–17)";
  if (min >= 18) return "Adults (18+)";
  if (min <= 4 && max >= 26) return "All Ages";
  return "Youth & Young Adults (12–25)";
}

/**
 * Parse and clean the TaxonomyTerms field into an array of distinct terms.
 * Source: "Substance Use Disorder Counselling; Individual Counselling; "
 */
function parseTaxonomyTerms(val: string | null): string[] {
  if (!val) return [];
  return String(val)
    .split(";")
    .map(t => t.trim())
    .filter(t => t.length > 0 && !t.startsWith("Previous ID"));
}

// ── Main import function ──────────────────────────────────────────────────────

async function importServices() {
  console.log("📂 Reading Excel file...");
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[];
  console.log(`   ✔ ${raw.length} rows found\n`);

  // Truncate existing data
  console.log("🗑  Clearing existing data...");
  await db.delete(serviceTaxonomyTable);
  await db.delete(servicesTable);
  console.log("   ✔ Cleared\n");

  console.log("🔄 Transforming and inserting services...");

  const BATCH_SIZE = 200;
  let inserted = 0;

  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const batch = raw.slice(i, i + BATCH_SIZE);

    const serviceValues = batch.map((r) => ({
      resourceAgencyNum: r["ResourceAgencyNum"] != null ? String(r["ResourceAgencyNum"]) : null,
      publicName: r["PublicName"] as string | null,
      officialName: r["OfficialName"] as string | null,
      taxonomyLevel: r["TaxonomyLevelName"] as string | null,
      agencyStatus: r["AgencyStatus"] as string | null,
      agencyDescription: stripHtml(r["AgencyDescription"] as string | null),
      websiteAddress: r["WebsiteAddress"] as string | null,
      coverageArea: r["CoverageArea"] as string | null,
      normalWaitTime: r["NormalWaitTime"] as string | null,
      languagesOfferedList: r["LanguagesOfferedList"] as string | null,
      bilingualService: normalizeBilingual(r["Custom_Is this a bilingual service?"] as string | null),
      lgbtqSupport: normalizeYesNo(r["Custom_Are services provided to LGBTQ persons?"] as string | null),
      harmReduction: normalizeYesNo(r["Custom_Does your program offer a harm reduction approach to service?"] as string | null),
      eligibilityByAge: r["Custom_Eligibility by Age"] as string | null,
      eligibilityAgeGroup: deriveAgeGroup(r["Custom_Eligibility by Age"] as string | null),
      eligibilityByGender: normalizeGender(r["Custom_Eligibility by Gender"] as string | null),
      eligibilityAdult: Boolean(r["EligibilityAdult"]),
      eligibilityChild: Boolean(r["EligibilityChild"]),
      eligibilityTeen: Boolean(r["EligibilityTeen"]),
      eligibilityFamily: Boolean(r["EligibilityFamily"]),
      physicalCity: r["PhysicalCity"] as string | null,
      physicalCounty: r["PhysicalCounty"] as string | null,
      physicalPostalCode: r["PhysicalPostalCode"] as string | null,
      latitude: r["Latitude"] != null ? String(r["Latitude"]) : null,
      longitude: r["Longitude"] != null ? String(r["Longitude"]) : null,
      enteredOn: r["EnteredOn"] != null ? String(r["EnteredOn"]) : null,
      updatedOn: r["UpdatedOn"] != null ? String(r["UpdatedOn"]) : null,
    }));

    const insertedServices = await db
      .insert(servicesTable)
      .values(serviceValues)
      .returning({ id: servicesTable.id });

    // Insert taxonomy terms for each service
    const taxonomyValues: { serviceId: number; term: string }[] = [];
    batch.forEach((r, idx) => {
      const serviceId = insertedServices[idx]?.id;
      if (!serviceId) return;
      const terms = parseTaxonomyTerms(r["TaxonomyTerms"] as string | null);
      terms.forEach(term => taxonomyValues.push({ serviceId, term }));
    });

    if (taxonomyValues.length > 0) {
      // Insert taxonomy terms in sub-batches to avoid parameter limits
      for (let j = 0; j < taxonomyValues.length; j += 500) {
        await db.insert(serviceTaxonomyTable).values(taxonomyValues.slice(j, j + 500));
      }
    }

    inserted += insertedServices.length;
    process.stdout.write(`\r   ${inserted}/${raw.length} services processed...`);
  }

  console.log(`\n   ✔ ${inserted} services imported`);

  // Summary stats
  const [svcCount] = await db.execute<{ count: string }>(
    // @ts-ignore
    { text: "SELECT COUNT(*)::text AS count FROM services", values: [] }
  ).catch(() => [{ count: "?" }]);
  const [taxCount] = await db.execute<{ count: string }>(
    // @ts-ignore
    { text: "SELECT COUNT(*)::text AS count FROM service_taxonomy", values: [] }
  ).catch(() => [{ count: "?" }]);

  console.log("\n✅ Import complete!");
  console.log(`   services: ${inserted}`);
  process.exit(0);
}

importServices().catch((err) => {
  console.error("\n❌ Import failed:", err);
  process.exit(1);
});
