import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { servicesTable } from "./services";

/**
 * service_taxonomy — normalized taxonomy terms for each service.
 *
 * Each service can have multiple taxonomy terms (e.g. "Substance Use Disorder Counselling",
 * "Individual Counselling"). The source TaxonomyTerms field is semicolon-delimited,
 * and each term is split into its own row here for clean SQL GROUP BY analytics.
 */
export const serviceTaxonomyTable = pgTable("service_taxonomy", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id, { onDelete: "cascade" }),
  term: text("term").notNull(),
});

export const insertServiceTaxonomySchema = createInsertSchema(serviceTaxonomyTable).omit({ id: true });
export type InsertServiceTaxonomy = z.infer<typeof insertServiceTaxonomySchema>;
export type ServiceTaxonomy = typeof serviceTaxonomyTable.$inferSelect;
