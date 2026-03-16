import { pgTable, text, serial, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * services — one row per mental health service record from the KHP 2019 MOH dataset.
 *
 * Schema design notes:
 *   - bilingual_service, lgbtq_support, harm_reduction are normalized to boolean
 *     from the free-text Custom_ fields in the source data.
 *   - eligibility_by_gender is normalized: 'Female Only', 'Male Only', 'All Genders'
 *   - eligibility_age_group is derived by classifying the semicolon-delimited age
 *     list into broad groups: Children, Adolescents, Adults, All Ages.
 *   - Columns not used in analytics (phone numbers, contact names, etc.) are excluded.
 */
export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  resourceAgencyNum: text("resource_agency_num"),
  publicName: text("public_name"),
  officialName: text("official_name"),
  taxonomyLevel: text("taxonomy_level"),
  agencyStatus: text("agency_status"),
  agencyDescription: text("agency_description"),
  websiteAddress: text("website_address"),
  coverageArea: text("coverage_area"),
  normalWaitTime: text("normal_wait_time"),
  languagesOfferedList: text("languages_offered_list"),
  bilingualService: boolean("bilingual_service").default(false),
  lgbtqSupport: boolean("lgbtq_support").default(false),
  harmReduction: boolean("harm_reduction").default(false),
  eligibilityByAge: text("eligibility_by_age"),
  eligibilityAgeGroup: text("eligibility_age_group"),
  eligibilityByGender: text("eligibility_by_gender"),
  eligibilityAdult: boolean("eligibility_adult").default(false),
  eligibilityChild: boolean("eligibility_child").default(false),
  eligibilityTeen: boolean("eligibility_teen").default(false),
  eligibilityFamily: boolean("eligibility_family").default(false),
  physicalCity: text("physical_city"),
  physicalCounty: text("physical_county"),
  physicalPostalCode: text("physical_postal_code"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  enteredOn: text("entered_on"),
  updatedOn: text("updated_on"),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
