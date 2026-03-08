/**
 * Import insured accounts, contacts, policies, and coverages from Augusta Mutual dec pages.
 * Also deletes the old demo "Taylor Brooks" insured data.
 *
 * Usage: npx tsx setup/import-dec-insureds.ts
 */
import { prisma, disconnectPrisma } from "./seed-utils.js";

// ---------------------------------------------------------------------------
// Coverage line item
// ---------------------------------------------------------------------------

interface CoverageLine {
  section: "PROPERTY" | "LIABILITY" | "OPTIONAL" | "CREDIT";
  label: string;
  coverageCode: string | null;
  limitAmount: string | null;
  premiumAmount: string | null;
  premiumText: string | null;
}

// ---------------------------------------------------------------------------
// Dec record
// ---------------------------------------------------------------------------

interface DecRecord {
  policyNumber: string;
  namedInsureds: string[];
  mailTo: { name: string; street: string; city: string; stateCode: string; postalCode: string };
  property: { street: string; city: string; stateCode: string; postalCode: string; county: string };
  effectiveDate: string;
  expirationDate: string;
  premium: string;
  deductible: string;
  policyFormCode: string;
  forms: string[];
  coverages: CoverageLine[];
  mortgagee: string | null;
}

// ---------------------------------------------------------------------------
// Records from dec pages
// ---------------------------------------------------------------------------

const records: DecRecord[] = [
  {
    policyNumber: "4037055",
    namedInsureds: ["Ricky R Baliles"],
    mailTo: { name: "Ricky R Baliles", street: "PO Box 683", city: "Stanleytown", stateCode: "VA", postalCode: "24168" },
    property: { street: "114 Fairsky Dr", city: "Ridgeway", stateCode: "VA", postalCode: "24148", county: "Henry" },
    effectiveDate: "01/12/2026",
    expirationDate: "01/12/2027",
    premium: "1005.00",
    deductible: "500",
    policyFormCode: "HO-3",
    forms: ["AM Replacement (08/16)", "HO-NOTE (09/17)", "AM Coverage Notices and Contact Info (02/20)", "AMIC-BL (04/15)", "AM ML 0493 (08/22)", "AA 103 (01/24)", "FORM 3 (2.1)", "ML-55 (2.1)", "AM-401H (09/25)", "AMIC HO EB-SL 09/18", "AM-400 (04/15)", "HO 1744 (07/23)"],
    coverages: [
      { section: "PROPERTY", label: "A. Residence", coverageCode: "A", limitAmount: "144500", premiumAmount: "827.00", premiumText: null },
      { section: "PROPERTY", label: "B. Related Private Structures", coverageCode: "B", limitAmount: "14450", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "101150", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Cost and Loss of Rents", coverageCode: "D", limitAmount: "28900", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "L. Personal Liability", coverageCode: "L", limitAmount: "300000", premiumAmount: "22.00", premiumText: null },
      { section: "LIABILITY", label: "M. Medical Payments to Others", coverageCode: "M", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "Personal Injury", coverageCode: null, limitAmount: null, premiumAmount: "0.00", premiumText: null },
      { section: "OPTIONAL", label: "Replacement Cost Personal Property", coverageCode: null, limitAmount: null, premiumAmount: "29.00", premiumText: null },
      { section: "OPTIONAL", label: "Augusta Advantage", coverageCode: null, limitAmount: null, premiumAmount: "70.00", premiumText: null },
      { section: "OPTIONAL", label: "Equipment Breakdown and Service Line Coverage", coverageCode: null, limitAmount: null, premiumAmount: "60.00", premiumText: null },
      { section: "OPTIONAL", label: "Identity Recovery and Fraud Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Deductible Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "83.00", premiumText: null },
      { section: "CREDIT", label: "Smoke Alarm Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Dead Bolt Locks Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Fire Extinguisher Credit", coverageCode: null, limitAmount: null, premiumAmount: "-12.00", premiumText: null },
      { section: "CREDIT", label: "Claim Free Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
      { section: "CREDIT", label: "Renewal Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
    ],
    mortgagee: "BOKF, NA DBA Firstland Mortgage Servicing, Inc",
  },
  {
    policyNumber: "4018022",
    namedInsureds: ["Edith M Alexander"],
    mailTo: { name: "Samuel P. Odell", street: "198 Country Haven Road", city: "Ridgeway", stateCode: "VA", postalCode: "24148" },
    property: { street: "198 Country Haven Dr", city: "Ridgeway", stateCode: "VA", postalCode: "24148", county: "Henry" },
    effectiveDate: "02/01/2026",
    expirationDate: "02/01/2027",
    premium: "1498.00",
    deductible: "500",
    policyFormCode: "HO-3",
    forms: ["AM Replacement (08/16)", "HO-NOTE (09/17)", "AM Coverage Notices and Contact Info (02/20)", "AMIC-BL (04/15)", "AM ML 0493 (08/22)", "AA 103 (01/24)", "FORM 3 (2.1)", "ML-55 (2.1)", "ML-41 (1.0)", "AMIC HO EB-SL 09/18", "AM-400 (04/15)"],
    coverages: [
      { section: "PROPERTY", label: "A. Residence", coverageCode: "A", limitAmount: "272000", premiumAmount: "1231.00", premiumText: null },
      { section: "PROPERTY", label: "B. Related Private Structures", coverageCode: "B", limitAmount: "27200", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "190400", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Cost and Loss of Rents", coverageCode: "D", limitAmount: "54400", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "L. Personal Liability", coverageCode: "L", limitAmount: "300000", premiumAmount: "22.00", premiumText: null },
      { section: "LIABILITY", label: "M. Medical Payments to Others", coverageCode: "M", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Replacement Cost Personal Property", coverageCode: null, limitAmount: null, premiumAmount: "50.00", premiumText: null },
      { section: "OPTIONAL", label: "Equipment Breakdown and Service Line Coverage", coverageCode: null, limitAmount: null, premiumAmount: "60.00", premiumText: null },
      { section: "OPTIONAL", label: "Identity Recovery and Fraud Coverage", coverageCode: null, limitAmount: null, premiumAmount: "28.00", premiumText: null },
      { section: "OPTIONAL", label: "Deductible Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "123.00", premiumText: null },
      { section: "CREDIT", label: "Smoke Alarm Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Dead Bolt Locks Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Fire Extinguisher Credit", coverageCode: null, limitAmount: null, premiumAmount: "-12.00", premiumText: null },
      { section: "CREDIT", label: "Claim Free Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
      { section: "CREDIT", label: "Renewal Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
    ],
    mortgagee: null,
  },
  {
    policyNumber: "4029970",
    namedInsureds: ["Joseph S. Brown"],
    mailTo: { name: "Joseph S. Brown", street: "3270 Dyers Store Rd", city: "Martinsville", stateCode: "VA", postalCode: "24112" },
    property: { street: "3270 Dyers Store Rd", city: "Martinsville", stateCode: "VA", postalCode: "24112", county: "Henry" },
    effectiveDate: "03/13/2026",
    expirationDate: "03/13/2027",
    premium: "1416.00",
    deductible: "500",
    policyFormCode: "HO-3",
    forms: ["AM Replacement (08/16)", "HO-NOTE (09/17)", "AM Coverage Notices and Contact Info (02/20)", "AMIC-BL (04/15)", "AM ML 0493 (08/22)", "AA 103 (01/24)", "FORM 3 (2.1)", "ML-55 (2.1)", "AMIC HO EB-SL 09/18", "AM-400 (04/15)", "ML-200 (1.0)"],
    coverages: [
      { section: "PROPERTY", label: "A. Residence", coverageCode: "A", limitAmount: "213800", premiumAmount: "1226.00", premiumText: null },
      { section: "PROPERTY", label: "B. Related Private Structures", coverageCode: "B", limitAmount: "21380", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "149660", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Cost and Loss of Rents", coverageCode: "D", limitAmount: "42760", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "L. Personal Liability", coverageCode: "L", limitAmount: "300000", premiumAmount: "22.00", premiumText: null },
      { section: "LIABILITY", label: "M. Medical Payments to Others", coverageCode: "M", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Replacement Cost Personal Property", coverageCode: null, limitAmount: null, premiumAmount: "43.00", premiumText: null },
      { section: "OPTIONAL", label: "Equipment Breakdown and Service Line Coverage", coverageCode: null, limitAmount: null, premiumAmount: "60.00", premiumText: null },
      { section: "OPTIONAL", label: "Identity Recovery and Fraud Coverage", coverageCode: null, limitAmount: null, premiumAmount: "28.00", premiumText: null },
      { section: "OPTIONAL", label: "Mobile Home Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Deductible Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "123.00", premiumText: null },
      { section: "CREDIT", label: "Smoke Alarm Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Dead Bolt Locks Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Fire Extinguisher Credit", coverageCode: null, limitAmount: null, premiumAmount: "-12.00", premiumText: null },
      { section: "CREDIT", label: "Claim Free Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
      { section: "CREDIT", label: "Renewal Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
    ],
    mortgagee: "Truilant Federal Credit Union",
  },
  {
    policyNumber: "4031321",
    namedInsureds: ["William Boyle", "Jennifer Boyle"],
    mailTo: { name: "William Boyle and/or Jennifer Boyle", street: "717 Craig St", city: "Martinsville", stateCode: "VA", postalCode: "24112" },
    property: { street: "717 Craig St", city: "Martinsville", stateCode: "VA", postalCode: "24112", county: "Henry" },
    effectiveDate: "05/24/2025",
    expirationDate: "05/24/2026",
    premium: "1056.00",
    deductible: "500",
    policyFormCode: "HO-3",
    forms: ["AM Replacement (08/16)", "HO-NOTE (09/17)", "AM Coverage Notices and Contact Info (02/20)", "AMIC-BL (04/15)", "AM ML 0493 (08/22)", "AA 103 (01/24)", "FORM 3 (2.1)", "ML-55 (2.1)", "AMIC HO EB-SL 09/18", "AM-400 (04/15)"],
    coverages: [
      { section: "PROPERTY", label: "A. Residence", coverageCode: "A", limitAmount: "271100", premiumAmount: "778.00", premiumText: null },
      { section: "PROPERTY", label: "B. Related Private Structures", coverageCode: "B", limitAmount: "27110", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "189770", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Cost and Loss of Rents", coverageCode: "D", limitAmount: "54220", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "Territory Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "78.00", premiumText: null },
      { section: "LIABILITY", label: "L. Personal Liability", coverageCode: "L", limitAmount: "300000", premiumAmount: "22.00", premiumText: null },
      { section: "LIABILITY", label: "M. Medical Payments to Others", coverageCode: "M", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Replacement Cost Personal Property", coverageCode: null, limitAmount: null, premiumAmount: "50.00", premiumText: null },
      { section: "OPTIONAL", label: "Equipment Breakdown and Service Line Coverage", coverageCode: null, limitAmount: null, premiumAmount: "60.00", premiumText: null },
      { section: "OPTIONAL", label: "Identity Recovery and Fraud Coverage", coverageCode: null, limitAmount: null, premiumAmount: "28.00", premiumText: null },
      { section: "OPTIONAL", label: "Deductible Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "78.00", premiumText: null },
      { section: "CREDIT", label: "Smoke Alarm Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Dead Bolt Locks Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Fire Extinguisher Credit", coverageCode: null, limitAmount: null, premiumAmount: "-12.00", premiumText: null },
      { section: "CREDIT", label: "Claim Free Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
      { section: "CREDIT", label: "Renewal Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
    ],
    mortgagee: null,
  },
  {
    policyNumber: "4024008",
    namedInsureds: ["Eli Gentry", "Annie Mae Gentry"],
    mailTo: { name: "Eli Gentry and/or Annie Mae Gentry", street: "PO Box 426", city: "Spencer", stateCode: "VA", postalCode: "24165" },
    property: { street: "18863 A.L. Philpott Hwy", city: "Spencer", stateCode: "VA", postalCode: "24165", county: "Henry" },
    effectiveDate: "07/01/2025",
    expirationDate: "07/01/2026",
    premium: "1223.00",
    deductible: "500",
    policyFormCode: "HO-3",
    forms: ["AM Replacement (08/16)", "HO-NOTE (09/17)", "AM Coverage Notices and Contact Info (02/20)", "AMIC-BL (04/15)", "AM ML 0493 (08/22)", "AA 103 (01/24)", "FORM 3 (2.1)", "ML-55 (2.1)", "AMIC HO EB-SL 09/18", "AM-400 (04/15)", "ML-200 (1.0)", "ML-216 (2.0)"],
    coverages: [
      { section: "PROPERTY", label: "A. Residence", coverageCode: "A", limitAmount: "237800", premiumAmount: "1051.00", premiumText: null },
      { section: "PROPERTY", label: "B. Related Private Structures", coverageCode: "B", limitAmount: "23780", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "166460", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Cost and Loss of Rents", coverageCode: "D", limitAmount: "47560", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "Territory Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "47.00", premiumText: null },
      { section: "LIABILITY", label: "L. Personal Liability", coverageCode: "L", limitAmount: "300000", premiumAmount: "22.00", premiumText: null },
      { section: "LIABILITY", label: "M. Medical Payments to Others", coverageCode: "M", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Replacement Cost Personal Property", coverageCode: null, limitAmount: null, premiumAmount: "48.00", premiumText: null },
      { section: "OPTIONAL", label: "Equipment Breakdown and Service Line Coverage", coverageCode: null, limitAmount: null, premiumAmount: "60.00", premiumText: null },
      { section: "OPTIONAL", label: "Identity Recovery and Fraud Coverage", coverageCode: null, limitAmount: null, premiumAmount: "28.00", premiumText: null },
      { section: "OPTIONAL", label: "Mobile Home Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Deductible Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "105.00", premiumText: null },
      { section: "CREDIT", label: "Smoke Alarm Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Burglary Alarm Credit", coverageCode: null, limitAmount: null, premiumAmount: "-50.00", premiumText: null },
      { section: "CREDIT", label: "Dead Bolt Locks Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Fire Extinguisher Credit", coverageCode: null, limitAmount: null, premiumAmount: "-12.00", premiumText: null },
      { section: "CREDIT", label: "Claim Free Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
      { section: "CREDIT", label: "Renewal Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
    ],
    mortgagee: null,
  },
  {
    policyNumber: "4037587",
    namedInsureds: ["Pamela Anglin"],
    mailTo: { name: "Pamela Anglin", street: "980 Laurel Park Ave", city: "Martinsville", stateCode: "VA", postalCode: "24112" },
    property: { street: "980 Laurel Park Ave", city: "Martinsville", stateCode: "VA", postalCode: "24112", county: "Henry" },
    effectiveDate: "08/17/2025",
    expirationDate: "08/17/2026",
    premium: "1684.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["AM Replacement (08/16)", "HO-NOTE (09/17)", "AM Coverage Notices and Contact Info (02/20)", "AMIC-BL (04/15)", "AM ML 0493 (08/22)", "AA 103 (01/24)", "FORM 3 (2.1)", "ML-55 (2.1)", "AM-401h (01/24)", "AMIC HO EB-SL 09/18", "AM-400 (04/15)", "HO 1744 (07/23)"],
    coverages: [
      { section: "PROPERTY", label: "A. Residence", coverageCode: "A", limitAmount: "332000", premiumAmount: "1565.00", premiumText: null },
      { section: "PROPERTY", label: "B. Related Private Structures", coverageCode: "B", limitAmount: "33200", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "232400", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Cost and Loss of Rents", coverageCode: "D", limitAmount: "66400", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "Territory Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "125.00", premiumText: null },
      { section: "LIABILITY", label: "L. Personal Liability", coverageCode: "L", limitAmount: "300000", premiumAmount: "22.00", premiumText: null },
      { section: "LIABILITY", label: "M. Medical Payments to Others", coverageCode: "M", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "Personal Injury", coverageCode: null, limitAmount: null, premiumAmount: "0.00", premiumText: null },
      { section: "OPTIONAL", label: "Replacement Cost Personal Property", coverageCode: null, limitAmount: null, premiumAmount: "50.00", premiumText: null },
      { section: "OPTIONAL", label: "Augusta Advantage", coverageCode: null, limitAmount: null, premiumAmount: "70.00", premiumText: null },
      { section: "OPTIONAL", label: "Equipment Breakdown and Service Line Coverage", coverageCode: null, limitAmount: null, premiumAmount: "60.00", premiumText: null },
      { section: "OPTIONAL", label: "Identity Recovery and Fraud Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Deductible Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "-150.00", premiumText: null },
      { section: "CREDIT", label: "Smoke Alarm Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Dead Bolt Locks Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Fire Extinguisher Credit", coverageCode: null, limitAmount: null, premiumAmount: "-12.00", premiumText: null },
      { section: "CREDIT", label: "Renewal Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
    ],
    mortgagee: null,
  },
  {
    policyNumber: "4020616",
    namedInsureds: ["Charles A. Simpson", "Barbara J. Simpson"],
    mailTo: { name: "Charles A. Simpson and/or Barbara J. Simpson", street: "289 Tommy Carter Rd", city: "Axton", stateCode: "VA", postalCode: "24054" },
    property: { street: "289 Tommy Carter Rd", city: "Axton", stateCode: "VA", postalCode: "24054", county: "Henry" },
    effectiveDate: "09/30/2025",
    expirationDate: "09/30/2026",
    premium: "1488.00",
    deductible: "500",
    policyFormCode: "HO-3",
    forms: ["AM Replacement (08/16)", "HO-NOTE (09/17)", "AM Coverage Notices and Contact Info (02/20)", "AMIC-BL (04/15)", "AM ML 0493 (08/22)", "AA 103 (01/24)", "FORM 3 (2.1)", "ML-55 (2.1)", "AMIC HO EB-SL 09/18", "AM-400 (04/15)", "ML-200 (1.0)"],
    coverages: [
      { section: "PROPERTY", label: "A. Residence", coverageCode: "A", limitAmount: "224600", premiumAmount: "1248.00", premiumText: null },
      { section: "PROPERTY", label: "B. Related Private Structures", coverageCode: "B", limitAmount: "22460", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "157220", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Cost and Loss of Rents", coverageCode: "D", limitAmount: "44920", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "L. Personal Liability", coverageCode: "L", limitAmount: "300000", premiumAmount: "22.00", premiumText: null },
      { section: "LIABILITY", label: "M. Medical Payments to Others", coverageCode: "M", limitAmount: "2000", premiumAmount: "16.00", premiumText: null },
      { section: "OPTIONAL", label: "Replacement Cost Personal Property", coverageCode: null, limitAmount: null, premiumAmount: "45.00", premiumText: null },
      { section: "OPTIONAL", label: "Equipment Breakdown and Service Line Coverage", coverageCode: null, limitAmount: null, premiumAmount: "60.00", premiumText: null },
      { section: "OPTIONAL", label: "Identity Recovery and Fraud Coverage", coverageCode: null, limitAmount: null, premiumAmount: "28.00", premiumText: null },
      { section: "OPTIONAL", label: "Mobile Home Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Deductible Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "125.00", premiumText: null },
      { section: "CREDIT", label: "Smoke Alarm Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Dead Bolt Locks Credit", coverageCode: null, limitAmount: null, premiumAmount: "-8.00", premiumText: null },
      { section: "CREDIT", label: "Fire Extinguisher Credit", coverageCode: null, limitAmount: null, premiumAmount: "-12.00", premiumText: null },
      { section: "CREDIT", label: "Renewal Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
    ],
    mortgagee: null,
  },
  {
    policyNumber: "10-2018-7367",
    namedInsureds: ["Austin Arnold"],
    mailTo: { name: "Jeffrey Arnold", street: "383 Applewood Rd", city: "Martinsville", stateCode: "VA", postalCode: "24112" },
    property: { street: "405 Applewood Rd", city: "Martinsville", stateCode: "VA", postalCode: "24112", county: "Henry" },
    effectiveDate: "12/06/2025",
    expirationDate: "12/06/2026",
    premium: "891.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["AM Replacement (08/16)", "HO-NOTE (09/17)", "AM Coverage Notices and Contact Info (02/20)", "AMIC-BL (04/15)", "AM ML 0493 (08/22)", "AA 103 (01/24)", "FORM 3 (2.1)", "ML-55 (2.1)", "ML-41 (1.0)", "AM-400 (04/15)", "ML-208 (3.1)"],
    coverages: [
      { section: "PROPERTY", label: "A. Residence", coverageCode: "A", limitAmount: "194900", premiumAmount: "911.00", premiumText: null },
      { section: "PROPERTY", label: "B. Related Private Structures", coverageCode: "B", limitAmount: "19490", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "136430", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Cost and Loss of Rents", coverageCode: "D", limitAmount: "38980", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "L. Personal Liability", coverageCode: "L", limitAmount: "300000", premiumAmount: "22.00", premiumText: null },
      { section: "LIABILITY", label: "M. Medical Payments to Others", coverageCode: "M", limitAmount: "5000", premiumAmount: "26.00", premiumText: null },
      { section: "OPTIONAL", label: "Replacement Cost Personal Property", coverageCode: null, limitAmount: null, premiumAmount: "39.00", premiumText: null },
      { section: "OPTIONAL", label: "Identity Recovery and Fraud Coverage", coverageCode: null, limitAmount: null, premiumAmount: "28.00", premiumText: null },
      { section: "OPTIONAL", label: "Deductible Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "-137.00", premiumText: null },
      { section: "CREDIT", label: "Claim Free Credit", coverageCode: null, limitAmount: null, premiumAmount: "-20.00", premiumText: null },
      { section: "CREDIT", label: "Renewal Credit", coverageCode: null, limitAmount: null, premiumAmount: "-30.00", premiumText: null },
    ],
    mortgagee: null,
  },
  {
    policyNumber: "10-2017-6597",
    namedInsureds: ["Damian L Brooks"],
    mailTo: { name: "Damian L Brooks", street: "228 Eastview Dr", city: "Collinsville", stateCode: "VA", postalCode: "24078" },
    property: { street: "228 Eastview Dr", city: "Collinsville", stateCode: "VA", postalCode: "24078", county: "Henry" },
    effectiveDate: "12/11/2025",
    expirationDate: "12/11/2026",
    premium: "996.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["AM Replacement (08/16)", "HO-NOTE (09/17)", "AM Coverage Notices and Contact Info (02/20)", "AMIC-BL (04/15)", "AM ML 0493 (08/22)", "AA 103 (01/24)", "FORM 3 (2.1)", "ML-55 (2.1)", "AMIC HO EB-SL 09/18", "AM-400 (04/15)"],
    coverages: [
      { section: "PROPERTY", label: "A. Residence", coverageCode: "A", limitAmount: "191600", premiumAmount: "965.00", premiumText: null },
      { section: "PROPERTY", label: "B. Related Private Structures", coverageCode: "B", limitAmount: "19160", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "134120", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Cost and Loss of Rents", coverageCode: "D", limitAmount: "38320", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "L. Personal Liability", coverageCode: "L", limitAmount: "300000", premiumAmount: "22.00", premiumText: null },
      { section: "LIABILITY", label: "M. Medical Payments to Others", coverageCode: "M", limitAmount: "5000", premiumAmount: "26.00", premiumText: null },
      { section: "OPTIONAL", label: "Replacement Cost Personal Property", coverageCode: null, limitAmount: null, premiumAmount: "38.00", premiumText: null },
      { section: "OPTIONAL", label: "Equipment Breakdown and Service Line Coverage", coverageCode: null, limitAmount: null, premiumAmount: "60.00", premiumText: null },
      { section: "OPTIONAL", label: "Identity Recovery and Fraud Coverage", coverageCode: null, limitAmount: null, premiumAmount: "28.00", premiumText: null },
      { section: "OPTIONAL", label: "Deductible Adjustment", coverageCode: null, limitAmount: null, premiumAmount: "-145.00", premiumText: null },
    ],
    mortgagee: null,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(s: string): Date {
  const [m, d, y] = s.split("/");
  return new Date(`${y}-${m}-${d}`);
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function makeAccountCode(name: string, policyNumber: string): string {
  const parts = name.split(/\s+/);
  const lastName = parts[parts.length - 1].toUpperCase().replace(/[^A-Z]/g, "");
  const suffix = policyNumber.replace(/-/g, "").slice(-4);
  return `${lastName}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const agency = await prisma.agency.findUnique({ where: { slug: "blue-ridge-insurance" } });
  if (!agency) throw new Error("Agency 'blue-ridge-insurance' not found. Run seed-demo.ts first.");

  const virginia = await prisma.state.findUnique({ where: { code: "VA" } });
  if (!virginia) throw new Error("State VA not found. Run seed-reference.ts first.");

  const homeowners = await prisma.policyType.findUnique({ where: { code: "HOMEOWNERS" } });
  if (!homeowners) throw new Error("Policy type HOMEOWNERS not found.");

  const augustaMutual = await prisma.carrier.findUnique({ where: { slug: "augusta-mutual" } });
  if (!augustaMutual) throw new Error("Carrier 'augusta-mutual' not found.");

  // --- Delete old demo insured data ---
  console.log("Deleting old demo insured data...");
  const demoAccounts = await prisma.insuredAccount.findMany({
    where: { agencyId: agency.id, sourceSystem: "spreadsheet" },
    select: { id: true, displayName: true },
  });
  for (const acct of demoAccounts) {
    await prisma.insuredAccount.delete({ where: { id: acct.id } });
    console.log(`  x Deleted: ${acct.displayName}`);
  }

  // --- Import real insured records ---
  console.log("\nImporting insured records from dec pages...");

  for (const rec of records) {
    const primaryName = rec.namedInsureds[0];
    const displayName = rec.namedInsureds.length > 1
      ? `${rec.namedInsureds.join(" & ")} Household`
      : `${primaryName} Household`;
    const accountCode = makeAccountCode(primaryName, rec.policyNumber);

    // Create insured account
    const account = await prisma.insuredAccount.upsert({
      where: { agencyId_accountCode: { agencyId: agency.id, accountCode } },
      update: {
        displayName,
        primaryStateId: virginia.id,
        streetLineOne: rec.mailTo.street,
        city: rec.mailTo.city,
        stateCode: rec.mailTo.stateCode,
        postalCode: rec.mailTo.postalCode,
        county: rec.property.county,
        sourceSystem: "dec_import",
      },
      create: {
        agencyId: agency.id,
        accountCode,
        displayName,
        primaryStateId: virginia.id,
        streetLineOne: rec.mailTo.street,
        city: rec.mailTo.city,
        stateCode: rec.mailTo.stateCode,
        postalCode: rec.mailTo.postalCode,
        county: rec.property.county,
        sourceSystem: "dec_import",
      },
    });

    // Create contacts for each named insured
    for (let i = 0; i < rec.namedInsureds.length; i++) {
      const { first, last } = splitName(rec.namedInsureds[i]);
      const existing = await prisma.insuredContact.findFirst({
        where: { insuredAccountId: account.id, firstName: first, lastName: last },
      });
      if (!existing) {
        await prisma.insuredContact.create({
          data: {
            insuredAccountId: account.id,
            firstName: first,
            lastName: last,
            isPrimary: i === 0,
            relationship: i === 0 ? "Named Insured" : "Co-Insured",
          },
        });
      }
    }

    // If mailTo name differs from named insured, add as additional contact
    const mailToName = rec.mailTo.name.replace(/ and\/or .+/, "").trim();
    const primaryNameNormalized = rec.namedInsureds[0].trim();
    if (mailToName !== primaryNameNormalized && !rec.namedInsureds.some(n => n.trim() === mailToName)) {
      const { first, last } = splitName(mailToName);
      const existing = await prisma.insuredContact.findFirst({
        where: { insuredAccountId: account.id, firstName: first, lastName: last },
      });
      if (!existing) {
        await prisma.insuredContact.create({
          data: {
            insuredAccountId: account.id,
            firstName: first,
            lastName: last,
            isPrimary: false,
            relationship: "Mail Recipient",
          },
        });
      }
    }

    // Create policy
    const policy = await prisma.policy.upsert({
      where: { agencyId_policyNumber: { agencyId: agency.id, policyNumber: rec.policyNumber } },
      update: {
        insuredAccountId: account.id,
        policyTypeId: homeowners.id,
        carrierId: augustaMutual.id,
        stateId: virginia.id,
        status: "ACTIVE",
        effectiveDate: parseDate(rec.effectiveDate),
        expirationDate: parseDate(rec.expirationDate),
        premium: rec.premium,
        deductible: rec.deductible,
        policyFormCode: rec.policyFormCode,
        decForms: rec.forms,
        mortgagee: rec.mortgagee,
        propertyStreet: rec.property.street,
        propertyCity: rec.property.city,
        propertyStateCode: rec.property.stateCode,
        propertyPostalCode: rec.property.postalCode,
        propertyCounty: rec.property.county,
        extractedCarrierName: "Augusta Mutual",
        readinessSource: "DECLARATION_PAGE",
        readinessConfirmedAt: new Date(),
      },
      create: {
        agencyId: agency.id,
        insuredAccountId: account.id,
        policyTypeId: homeowners.id,
        carrierId: augustaMutual.id,
        stateId: virginia.id,
        policyNumber: rec.policyNumber,
        status: "ACTIVE",
        effectiveDate: parseDate(rec.effectiveDate),
        expirationDate: parseDate(rec.expirationDate),
        premium: rec.premium,
        deductible: rec.deductible,
        policyFormCode: rec.policyFormCode,
        decForms: rec.forms,
        mortgagee: rec.mortgagee,
        propertyStreet: rec.property.street,
        propertyCity: rec.property.city,
        propertyStateCode: rec.property.stateCode,
        propertyPostalCode: rec.property.postalCode,
        propertyCounty: rec.property.county,
        extractedCarrierName: "Augusta Mutual",
        readinessSource: "DECLARATION_PAGE",
        readinessConfirmedAt: new Date(),
      },
    });

    // Delete existing coverages (for idempotent re-runs)
    await prisma.policyCoverage.deleteMany({ where: { policyId: policy.id } });

    // Create coverage line items
    for (let i = 0; i < rec.coverages.length; i++) {
      const cov = rec.coverages[i];
      await prisma.policyCoverage.create({
        data: {
          policyId: policy.id,
          section: cov.section,
          label: cov.label,
          coverageCode: cov.coverageCode,
          limitAmount: cov.limitAmount,
          premiumAmount: cov.premiumAmount,
          premiumText: cov.premiumText,
          source: "dec_import",
          sortOrder: i,
        },
      });
    }

    const contactCount = rec.namedInsureds.length + (mailToName !== primaryNameNormalized && !rec.namedInsureds.some(n => n.trim() === mailToName) ? 1 : 0);
    console.log(`  + ${displayName} (${accountCode}) -- policy ${rec.policyNumber}, ${contactCount} contacts, ${rec.coverages.length} coverages, ${rec.forms.length} forms`);
  }

  console.log(`\nImported ${records.length} insured accounts with policies, coverages, and forms.`);
}

main()
  .then(() => disconnectPrisma())
  .catch(async (e) => {
    console.error(e);
    await disconnectPrisma();
    process.exit(1);
  });
