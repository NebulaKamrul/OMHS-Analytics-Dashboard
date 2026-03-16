/**
 * Seed script for Hospital Operations Analytics Dashboard
 *
 * Generates realistic synthetic data for Ontario Shores Centre for Mental Health Sciences.
 * Covers ~18 months of data (Jan 2024 – June 2025) to enable meaningful trend analysis.
 *
 * Run: pnpm --filter @workspace/scripts run seed
 */

import { db } from "@workspace/db";
import {
  departmentsTable,
  patientsTable,
  staffTable,
  bedsTable,
  admissionsTable,
  appointmentsTable,
} from "@workspace/db";

// ── Helpers ──────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFrom<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ── Department definitions ────────────────────────────────────────────────────

const DEPARTMENTS = [
  { name: "Psychiatry", code: "PSY", totalBeds: 40, staffCount: 28 },
  { name: "Emergency", code: "EMG", totalBeds: 20, staffCount: 35 },
  { name: "Outpatient Services", code: "OUT", totalBeds: 10, staffCount: 18 },
  { name: "Addictions and Mental Health", code: "AMH", totalBeds: 30, staffCount: 22 },
  { name: "Community Care", code: "COM", totalBeds: 15, staffCount: 12 },
];

// ── Staff roles ───────────────────────────────────────────────────────────────

const STAFF_ROLES = [
  "Psychiatrist",
  "Registered Nurse",
  "Social Worker",
  "Occupational Therapist",
  "Mental Health Worker",
  "Addiction Counsellor",
  "Psychologist",
  "Case Manager",
];

// ── Patient name pools ────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "James", "Emily", "Michael", "Sarah", "David", "Jessica", "Robert", "Jennifer",
  "William", "Amanda", "Richard", "Melissa", "Thomas", "Ashley", "Charles", "Stephanie",
  "Daniel", "Nicole", "Matthew", "Elizabeth", "Christopher", "Lauren", "Joshua", "Rachel",
  "Andrew", "Megan", "Kevin", "Rebecca", "Brian", "Maria", "George", "Sandra", "Edward",
  "Patricia", "Mark", "Catherine", "Anthony", "Angela", "Donald", "Heather", "Steven",
  "Julie", "Paul", "Brittany", "Ryan", "Kimberly", "Justin", "Christina", "Nathan", "Danielle",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson",
  "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin",
  "Thompson", "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee",
  "Walker", "Hall", "Allen", "Young", "Hernandez", "King", "Wright", "Lopez", "Hill",
  "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter", "Mitchell",
  "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards",
];

// ── Appointment types and statuses ────────────────────────────────────────────

const APPOINTMENT_TYPES = ["outpatient", "followup", "assessment", "group_therapy", "intake"];
const APPOINTMENT_STATUSES_WEIGHTED = [
  ...Array(60).fill("completed"),
  ...Array(25).fill("scheduled"),
  ...Array(15).fill("cancelled"),
];

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding hospital database...\n");

  const DATA_START = new Date("2024-01-01T00:00:00Z");
  const DATA_END = new Date("2025-06-30T23:59:59Z");

  // 1. Seed departments
  console.log("Inserting departments...");
  const insertedDepts = await db
    .insert(departmentsTable)
    .values(DEPARTMENTS)
    .onConflictDoNothing()
    .returning();

  const deptIds = insertedDepts.map((d) => d.id);
  const deptMap = new Map(insertedDepts.map((d) => [d.id, d]));
  console.log(`  ✔  ${insertedDepts.length} departments`);

  // 2. Seed staff (proportional to staffCount)
  console.log("Inserting staff...");
  const staffRecords = [];
  for (const dept of insertedDepts) {
    for (let i = 0; i < dept.staffCount; i++) {
      staffRecords.push({
        firstName: randFrom(FIRST_NAMES),
        lastName: randFrom(LAST_NAMES),
        role: randFrom(STAFF_ROLES),
        departmentId: dept.id,
      });
    }
  }
  const insertedStaff = await db
    .insert(staffTable)
    .values(staffRecords)
    .returning();
  console.log(`  ✔  ${insertedStaff.length} staff members`);

  // Group staff by department for appointment assignment
  const staffByDept = new Map<number, number[]>();
  for (const s of insertedStaff) {
    if (!staffByDept.has(s.departmentId)) staffByDept.set(s.departmentId, []);
    staffByDept.get(s.departmentId)!.push(s.id);
  }

  // 3. Seed beds (one row per bed per department)
  console.log("Inserting beds...");
  const bedRecords = [];
  for (const dept of insertedDepts) {
    for (let b = 1; b <= dept.totalBeds; b++) {
      bedRecords.push({
        bedNumber: `${dept.code}-${String(b).padStart(3, "0")}`,
        departmentId: dept.id,
        status: "available",
      });
    }
  }
  const insertedBeds = await db
    .insert(bedsTable)
    .values(bedRecords)
    .returning();
  const bedsByDept = new Map<number, number[]>();
  for (const bed of insertedBeds) {
    if (!bedsByDept.has(bed.departmentId)) bedsByDept.set(bed.departmentId, []);
    bedsByDept.get(bed.departmentId)!.push(bed.id);
  }
  console.log(`  ✔  ${insertedBeds.length} beds`);

  // 4. Seed patients (300 unique patients)
  console.log("Inserting patients...");
  const patientRecords = Array.from({ length: 300 }, (_, i) => ({
    firstName: randFrom(FIRST_NAMES),
    lastName: randFrom(LAST_NAMES),
    dateOfBirth: new Date(
      randInt(1950, 2000),
      randInt(0, 11),
      randInt(1, 28)
    ).toISOString().slice(0, 10),
    gender: randFrom(["male", "female", "non-binary"]),
    healthCardNumber: `ON${String(i + 1).padStart(7, "0")}`,
  }));

  const insertedPatients = await db
    .insert(patientsTable)
    .values(patientRecords)
    .onConflictDoNothing()
    .returning();
  const patientIds = insertedPatients.map((p) => p.id);
  console.log(`  ✔  ${insertedPatients.length} patients`);

  // 5. Seed admissions (~850 admissions over 18 months)
  console.log("Inserting admissions...");
  const admissionRecords = [];
  for (let i = 0; i < 850; i++) {
    const deptId = randFrom(deptIds);
    const dept = deptMap.get(deptId)!;
    const beds = bedsByDept.get(deptId) ?? [];
    const admissionDate = randomDate(DATA_START, new Date("2025-05-01T00:00:00Z"));

    // 65% of admissions are discharged, 35% still admitted
    const discharged = Math.random() < 0.65;
    // Length of stay varies by department: Psychiatry/AMH longer, Emergency shorter
    const losMin = deptId === 1 || dept.code === "AMH" ? 7 : (dept.code === "EMG" ? 1 : 3);
    const losMax = deptId === 1 || dept.code === "AMH" ? 45 : (dept.code === "EMG" ? 5 : 14);
    const los = randInt(losMin, losMax);
    const dischargeDate = discharged ? addDays(admissionDate, los) : null;

    admissionRecords.push({
      patientId: randFrom(patientIds),
      departmentId: deptId,
      bedId: beds.length > 0 ? randFrom(beds) : null,
      admissionDate,
      dischargeDate,
      status: discharged ? "discharged" : "admitted",
      admissionType: randFrom(["inpatient", "emergency", "voluntary"]),
    });
  }

  const insertedAdmissions = await db
    .insert(admissionsTable)
    .values(admissionRecords)
    .returning();
  console.log(`  ✔  ${insertedAdmissions.length} admissions`);

  // 6. Seed appointments (~1200 appointments over 18 months)
  console.log("Inserting appointments...");
  const apptRecords = [];
  for (let i = 0; i < 1200; i++) {
    const deptId = randFrom(deptIds);
    const deptStaff = staffByDept.get(deptId) ?? [];
    apptRecords.push({
      patientId: randFrom(patientIds),
      departmentId: deptId,
      staffId: deptStaff.length > 0 ? randFrom(deptStaff) : null,
      scheduledAt: randomDate(DATA_START, DATA_END),
      status: randFrom(APPOINTMENT_STATUSES_WEIGHTED),
      appointmentType: randFrom(APPOINTMENT_TYPES),
      notes: null,
    });
  }

  const insertedAppointments = await db
    .insert(appointmentsTable)
    .values(apptRecords)
    .returning();
  console.log(`  ✔  ${insertedAppointments.length} appointments`);

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
