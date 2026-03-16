import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";

export const bedsTable = pgTable("beds", {
  id: serial("id").primaryKey(),
  bedNumber: text("bed_number").notNull(),
  departmentId: integer("department_id").notNull().references(() => departmentsTable.id),
  status: text("status").notNull().default("available"),
});

export const insertBedSchema = createInsertSchema(bedsTable).omit({ id: true });
export type InsertBed = z.infer<typeof insertBedSchema>;
export type Bed = typeof bedsTable.$inferSelect;
