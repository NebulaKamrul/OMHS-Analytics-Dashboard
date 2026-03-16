import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { departmentsTable } from "./departments";
import { bedsTable } from "./beds";

export const admissionsTable = pgTable("admissions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  departmentId: integer("department_id").notNull().references(() => departmentsTable.id),
  bedId: integer("bed_id").references(() => bedsTable.id),
  admissionDate: timestamp("admission_date", { withTimezone: true }).notNull(),
  dischargeDate: timestamp("discharge_date", { withTimezone: true }),
  status: text("status").notNull().default("admitted"),
  admissionType: text("admission_type").notNull().default("inpatient"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdmissionSchema = createInsertSchema(admissionsTable).omit({ id: true, createdAt: true });
export type InsertAdmission = z.infer<typeof insertAdmissionSchema>;
export type Admission = typeof admissionsTable.$inferSelect;
