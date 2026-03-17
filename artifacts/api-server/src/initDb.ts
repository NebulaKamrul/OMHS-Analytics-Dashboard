/**
 * Production database initializer.
 *
 * On first startup (empty database), imports all 5,945 KHP 2019 MOH services
 * from the bundled xlsx file.  Subsequent startups skip the import entirely.
 *
 * Compatible with:
 *  - dev (tsx, ESM): __dirname not available; uses import.meta.url
 *  - production (esbuild CJS bundle): __dirname injected; import.meta is empty
 */

import * as path from "path";
import * as XLSXNs from "xlsx";
import { count as drizzleCount } from "drizzle-orm";
import { db, servicesTable, serviceTaxonomyTable } from "@workspace/db";

// xlsx is a CJS module; in ESM the methods are on .default, in CJS they're on the namespace
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const XLSX: any = (XLSXNs as any).default ?? XLSXNs;

/**
 * Returns the directory containing this file.
 * - In esbuild CJS bundles: __dirname is injected as a local variable (CJS module wrapper)
 * - In ESM (tsx dev mode): __dirname is undefined; fall back to import.meta.url
 */
function getDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalDir = (globalThis as any).__dirname as string | undefined;
  if (globalDir) return globalDir;

  // Check process.env.NODE_ENV: in dev, cwd() is the api-server root
  if (process.env.NODE_ENV !== "production") {
    return path.join(process.cwd(), "src");
  }

  // Production fallback: use the xlsx next to the running binary
  // When deployed, the process working directory should contain dist/
  return path.join(process.cwd(), "dist");
}

const EXCEL_PATH = path.join(getDir(), "khp_2019_moh_export.xlsx");

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return String(html).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null;
}

function normalizeBilingual(val: string | null): boolean {
  if (!val) return false;
  const v = String(val).toLowerCase();
  return v.includes("bilingual") || v.includes("bilingue");
}

function normalizeYesNo(val: string | null): boolean {
  if (!val) return false;
  const v = String(val).trim().toLowerCase();
  return v === "yes" || v === "oui";
}

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
  if (max <= 11) return "Children (0\u201311)";
  if (min >= 12 && max <= 17) return "Adolescents (12\u201317)";
  if (min >= 18) return "Adults (18+)";
  if (min <= 4 && max >= 26) return "All Ages";
  return "Youth & Young Adults (12\u201325)";
}

function parseTaxonomyTerms(val: string | null): string[] {
  if (!val) return [];
  return String(val)
    .split(";")
    .map(t => t.trim())
    .filter(t => t.length > 0 && !t.startsWith("Previous ID"));
}

export async function initDb(): Promise<void> {
  try {
    const [{ value }] = await db.select({ value: drizzleCount() }).from(servicesTable);
    if (value > 0) {
      console.log(`[initDb] Database already seeded (${value} services). Skipping import.`);
      return;
    }
  } catch (err) {
    console.log("[initDb] Could not query services table — skipping auto-seed.", err);
    return;
  }

  console.log("[initDb] Empty database detected. Importing KHP 2019 MOH data...");
  console.log(`[initDb] Reading: ${EXCEL_PATH}`);

  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[];
  console.log(`[initDb] ${raw.length} rows read from xlsx.`);

  await db.delete(serviceTaxonomyTable);
  await db.delete(servicesTable);

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

    const taxonomyValues: { serviceId: number; term: string }[] = [];
    batch.forEach((r, idx) => {
      const serviceId = insertedServices[idx]?.id;
      if (!serviceId) return;
      parseTaxonomyTerms(r["TaxonomyTerms"] as string | null).forEach(term =>
        taxonomyValues.push({ serviceId, term })
      );
    });

    if (taxonomyValues.length > 0) {
      for (let j = 0; j < taxonomyValues.length; j += 500) {
        await db.insert(serviceTaxonomyTable).values(taxonomyValues.slice(j, j + 500));
      }
    }

    inserted += insertedServices.length;
    console.log(`[initDb] ${inserted}/${raw.length} services inserted...`);
  }

  console.log(`[initDb] Done. ${inserted} services imported successfully.`);
}
