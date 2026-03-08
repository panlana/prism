/**
 * Import insured accounts, contacts, policies, and coverages from
 * Auto-Owners, Cincinnati, Universal Property, and Travelers dec pages.
 *
 * Usage: npx tsx setup/import-dec-other-carriers.ts
 */
import { prisma, disconnectPrisma } from "./seed-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoverageLine {
  section: "PROPERTY" | "LIABILITY" | "OPTIONAL" | "CREDIT";
  label: string;
  coverageCode: string | null;
  limitAmount: string | null;
  premiumAmount: string | null;
  premiumText: string | null;
}

interface DecRecord {
  carrierSlug: string;
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
  policyTypeCode?: string | undefined;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

const records: DecRecord[] = [
  // =========================================================================
  // AUTO-OWNERS — Sharon Cothran
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "53-707-930-00",
    namedInsureds: ["Sharon Cothran"],
    mailTo: { name: "Sharon Cothran", street: "231 Timber Ridge Dr", city: "Forest", stateCode: "VA", postalCode: "24551" },
    property: { street: "231 Timber Ridge Dr", city: "Forest", stateCode: "VA", postalCode: "24551", county: "Bedford" },
    effectiveDate: "01/28/2026",
    expirationDate: "01/28/2027",
    premium: "1240.39",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: [
      "17536 (12-23)", "57532 (08-13)", "57482 (08-13)", "17542 (12-23)", "17748 (12-23)",
      "17139 (12-23)", "17734 (12-23)", "57471 (12-23)", "57442 (08-15)", "67127 (12-23)",
      "57721 (06-16)", "57724 (01-22)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)",
      "57845 (07-18)", "57823 (12-23)", "67166 (07-24)", "67138 (12-23)", "17866 (12-04)",
    ],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "411500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "41150", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "320320", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "82300", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Homeowners Plus", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Mortgage Extra Expense Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "$250/mo" },
      { section: "OPTIONAL", label: "Refrigerated Products Coverage", coverageCode: null, limitAmount: "750", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Glass Breakage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Domestic Appliance Seepage or Leakage", coverageCode: null, limitAmount: "50000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Tree Debris Removal", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Backup of Sewers or Drains", coverageCode: null, limitAmount: "25000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Guaranteed Home Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Special Personal Property Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Earthquake Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "41150", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Theft Expense Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Undamaged Siding or Roofing", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Equipment Breakdown Coverage", coverageCode: null, limitAmount: "100000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Service Line Coverage", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Home/Auto Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Home/Umbrella Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Protective Devices Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Paid In Full Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Mortgage Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Claim Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Advance Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // CINCINNATI — Wesley Robert Cothran
  // =========================================================================
  {
    carrierSlug: "cincinnati",
    policyNumber: "H01 1303671",
    namedInsureds: ["Wesley Robert Cothran"],
    mailTo: { name: "Wesley Robert Cothran", street: "1071 Stonewood Ct", city: "Forest", stateCode: "VA", postalCode: "24551" },
    property: { street: "1071 Stonewood Ct", city: "Forest", stateCode: "VA", postalCode: "24551", county: "Bedford" },
    effectiveDate: "04/01/2025",
    expirationDate: "04/01/2026",
    premium: "4283.00",
    deductible: "2500",
    policyFormCode: "Executive Select",
    forms: [
      "ExecutiveSelectVA (1/22)", "HR783NA (1/22)", "HR793AVA (6/17)", "AP 403 VA 10 14",
      "IP462VA (1/18)", "MI1646VA (12/20)", "MI1659 (4/22)", "MI1785AVA (4/19)",
      "HR1024VA (1/22)", "HR1095VA (5/22)", "HR1117VA (1/22)", "HR1149VA (1/18)",
      "HR1177 (1/22)", "HR2016 (1/23)", "HR797 (10/04)", "HR961CVA (6/19)",
    ],
    coverages: [
      // Basic coverages (subtotal $2,521)
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "994000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "99400", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "497000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "198800", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability (BI & PD)", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Injury (Aggregate)", coverageCode: null, limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      // Endorsements (subtotal $1,762)
      { section: "OPTIONAL", label: "Earthquake", coverageCode: null, limitAmount: null, premiumAmount: "504.00", premiumText: null },
      { section: "OPTIONAL", label: "Preferred Primary Flood", coverageCode: null, limitAmount: "250000", premiumAmount: "408.00", premiumText: null },
      { section: "OPTIONAL", label: "Service Line Coverage", coverageCode: null, limitAmount: "10000", premiumAmount: "25.00", premiumText: null },
      { section: "OPTIONAL", label: "Landslide Coverage", coverageCode: null, limitAmount: null, premiumAmount: "249.00", premiumText: null },
      { section: "OPTIONAL", label: "Cincinnati Personal Cyber Protection", coverageCode: null, limitAmount: "100000", premiumAmount: "153.00", premiumText: null },
      { section: "OPTIONAL", label: "Sinkhole Collapse", coverageCode: null, limitAmount: null, premiumAmount: "348.00", premiumText: null },
      { section: "OPTIONAL", label: "Equipment Breakdown", coverageCode: null, limitAmount: "50000", premiumAmount: "75.00", premiumText: null },
      { section: "OPTIONAL", label: "Water Damage Coverage (Sewer/Drain Backup)", coverageCode: null, limitAmount: "50000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Guaranteed Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Increased Assessments Coverage", coverageCode: null, limitAmount: "50000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fungi/Bacteria Coverage (Section I)", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fungi/Bacteria Coverage (Section II)", coverageCode: null, limitAmount: "50000", premiumAmount: null, premiumText: "Incl." },
      // Credits
      { section: "CREDIT", label: "Central Station Burglar Credit", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Central Station Fire Credit", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Package Credit", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Pay Plan Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "Atlantic Bay Mortgage Group C/O Loancare LLC",
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Jerry Lee Crawford
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-2400-0962",
    namedInsureds: ["Jerry Lee Crawford"],
    mailTo: { name: "Jerry Lee Crawford", street: "218 Cabell Lane", city: "Amherst", stateCode: "VA", postalCode: "24521" },
    property: { street: "218 Cabell Ln", city: "Amherst", stateCode: "VA", postalCode: "24521", county: "Amherst" },
    effectiveDate: "03/20/2026",
    expirationDate: "03/20/2027",
    premium: "746.11",
    deductible: "2317",
    policyFormCode: "HO-3",
    forms: [
      "HO 00 03 03 22", "UPCIC 45 01 11 23", "HO 03 13 07 23",
      "IL P 052 01 13", "UPCIC 45 06 05 20",
    ],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "231692", premiumAmount: "785.03", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "23171", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "115846", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "46339", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: "24.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: "0.00", premiumText: null },
      { section: "OPTIONAL", label: "Age of Home Surcharge", coverageCode: null, limitAmount: null, premiumAmount: "70.15", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: "-77.95", premiumText: null },
      { section: "CREDIT", label: "Loyalty Discount", coverageCode: null, limitAmount: null, premiumAmount: "-80.12", premiumText: null },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // TRAVELERS — Christopher C & Carrie A England
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "616406311-633-1",
    namedInsureds: ["Christopher C England", "Carrie A England"],
    mailTo: { name: "Christopher C England", street: "1161 Cedarberry Ln", city: "Forest", stateCode: "VA", postalCode: "24551" },
    property: { street: "1161 Cedarberry Ln", city: "Forest", stateCode: "VA", postalCode: "24551", county: "Bedford" },
    effectiveDate: "09/19/2025",
    expirationDate: "09/19/2026",
    premium: "2550.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: [
      "HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)",
      "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)",
      "HQ-208 HO (04-23)", "HQ-209 VA (04-23)", "HQ-700 VA (05-18)", "HQ-701 VA (05-18)",
      "HQ-015 VA (04-23)", "HQ-082 HO (04-23)", "HQ-290 VA (04-23)", "HQ-420 VA (04-23)",
      "HQ-498 CW (05-17)", "HQ-855 CW (05-17)", "HQ-856 CW (08-20)",
    ],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "905000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "282813", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "452500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "181000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      // Enhanced Water Package
      { section: "OPTIONAL", label: "Water Back Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Limited Hidden Water or Steam Seepage", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      // Roof and Siding Matching Package
      { section: "OPTIONAL", label: "Matching of Undamaged Roof Surfacing", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Matching of Undamaged Siding", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      // Additional Coverage Package
      { section: "OPTIONAL", label: "Special Personal Property Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Injury Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection", coverageCode: null, limitAmount: "452500", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Increased Limit", coverageCode: null, limitAmount: "50000", premiumAmount: null, premiumText: "Incl." },
      // Buried Utility Lines and Equipment Breakdown Package
      { section: "OPTIONAL", label: "Equipment Breakdown Coverage", coverageCode: null, limitAmount: "50000", premiumAmount: "84.00", premiumText: null },
      { section: "OPTIONAL", label: "Buried Utility Lines Coverage", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      // Discounts (total savings $1,247)
      { section: "CREDIT", label: "Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Fire Protective Device Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "Blue Eagle Credit Union / The First Bank and Trust Com",
  },

  // =========================================================================
  // AUTO-OWNERS — Anna Marie Akers
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "53-949-569-00",
    namedInsureds: ["Anna Marie Akers"],
    mailTo: { name: "Anna Marie Akers", street: "300 Southland Dr", city: "Martinsville", stateCode: "VA", postalCode: "24112" },
    property: { street: "300 Southland Dr", city: "Martinsville", stateCode: "VA", postalCode: "24112", county: "Henry" },
    effectiveDate: "07/12/2025",
    expirationDate: "07/12/2026",
    premium: "1698.19",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["17536 (12-23)", "57482 (08-13)", "67107 (12-22)", "57471 (12-23)", "57442 (08-15)", "57721 (06-16)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)", "57845 (07-18)", "57823 (12-23)", "17866 (12-04)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "221500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "22150", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "155050", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "44300", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Backup of Sewers or Drains", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "22150", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Theft Expense Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Equipment Breakdown Coverage", coverageCode: null, limitAmount: "100000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Home/Auto Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Mortgage Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Claim Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // AUTO-OWNERS — Brady C Adams
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "55-257-570-00",
    namedInsureds: ["Brady C Adams"],
    mailTo: { name: "Brady C Adams", street: "PO Box 282", city: "Blairs", stateCode: "VA", postalCode: "24527" },
    property: { street: "228 Bent Tree Pl", city: "Blairs", stateCode: "VA", postalCode: "24527", county: "Pittsylvania" },
    effectiveDate: "05/09/2025",
    expirationDate: "05/09/2026",
    premium: "800.22",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["17536 (12-23)", "57482 (08-13)", "67107 (12-22)", "17542 (12-23)", "17748 (12-23)", "57442 (08-15)", "67122 (12-23)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)", "57845 (07-18)", "57823 (12-23)", "17866 (12-04)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "264500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "26450", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "230300", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "52900", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Homeowners Plus", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Guaranteed Home Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "50000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "264500", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Theft Expense Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Interior Matching Protection", coverageCode: null, limitAmount: "26450", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Home/Auto Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Protective Devices Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Paid In Full Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Mortgage Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Claim Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // AUTO-OWNERS — Celestine A Andrews
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "54-059-733-00",
    namedInsureds: ["Celestine A Andrews"],
    mailTo: { name: "Celestine A Andrews", street: "1425 Wise St", city: "Lynchburg", stateCode: "VA", postalCode: "24504" },
    property: { street: "1425 Wise St", city: "Lynchburg", stateCode: "VA", postalCode: "24504", county: "Lynchburg City" },
    effectiveDate: "09/20/2025",
    expirationDate: "09/20/2026",
    premium: "741.04",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["17536 (12-23)", "57532 (08-13)", "57482 (08-13)", "67107 (12-22)", "17542 (12-23)", "17552 (12-23)", "57471 (12-23)", "57442 (08-15)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)", "57845 (07-18)", "57823 (12-23)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "285500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "28550", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "199850", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "57100", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "100000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Homeowners Plus", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Backup of Sewers or Drains", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Increased Cost Endorsement", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "28550", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Protective Devices Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Paid In Full Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Mortgage Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Claim Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Advance Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // AUTO-OWNERS — Helen Adkins
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "54-763-325-00",
    namedInsureds: ["Helen Adkins"],
    mailTo: { name: "Helen Adkins", street: "1014 River Forest Pl", city: "Martinsville", stateCode: "VA", postalCode: "24112" },
    property: { street: "1014 River Forest Pl", city: "Martinsville", stateCode: "VA", postalCode: "24112", county: "Henry" },
    effectiveDate: "09/21/2025",
    expirationDate: "09/21/2026",
    premium: "2739.45",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["17536 (12-23)", "57482 (08-13)", "67107 (12-22)", "17542 (12-23)", "17139 (12-23)", "57442 (08-15)", "17552 (12-23)", "57721 (06-16)", "57724 (01-22)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)", "57845 (07-18)", "57823 (12-23)", "17866 (12-04)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "455000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "45500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "385980", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "91000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Homeowners Plus", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Special Personal Property Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "455000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Increased Cost Endorsement", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Theft Expense Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Equipment Breakdown Coverage", coverageCode: null, limitAmount: "100000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Service Line Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Claim Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Advance Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "Valley Star Credit Union",
  },

  // =========================================================================
  // AUTO-OWNERS — Mary Angelini
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "53-386-654-02",
    namedInsureds: ["Mary Angelini"],
    mailTo: { name: "Mary Angelini", street: "561 N Fork Rd", city: "Amherst", stateCode: "VA", postalCode: "24521" },
    property: { street: "561 N Fork Rd", city: "Amherst", stateCode: "VA", postalCode: "24521", county: "Amherst" },
    effectiveDate: "06/16/2025",
    expirationDate: "06/16/2026",
    premium: "2017.21",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["17536 (12-23)", "57482 (08-13)", "67107 (12-22)", "17542 (12-23)", "17748 (12-23)", "17139 (12-23)", "57442 (08-15)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)", "57845 (07-18)", "57823 (12-23)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "381000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "38100", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "266700", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "76200", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Homeowners Plus", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Guaranteed Home Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Special Personal Property Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "38100", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Home/Auto Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Home/Umbrella Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Protective Devices Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Mortgage Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Claim Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // AUTO-OWNERS — Robert E Allen Jr & Gail Allen
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "54-849-775-01",
    namedInsureds: ["Robert E Allen Jr", "Gail Allen"],
    mailTo: { name: "Robert E Allen Jr", street: "197 Saratoga Dr", city: "Lynchburg", stateCode: "VA", postalCode: "24502" },
    property: { street: "197 Saratoga Dr", city: "Lynchburg", stateCode: "VA", postalCode: "24502", county: "Campbell" },
    effectiveDate: "02/01/2026",
    expirationDate: "02/01/2027",
    premium: "1671.74",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["17536 (12-23)", "57532 (08-13)", "57482 (08-13)", "17542 (12-23)", "17552 (12-23)", "57471 (12-23)", "57442 (08-15)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)", "57845 (07-18)", "57823 (12-23)", "67166 (07-24)", "67138 (12-23)", "17866 (12-04)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "366300", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "36630", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "256410", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "73260", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Homeowners Plus", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Backup of Sewers or Drains", coverageCode: null, limitAmount: "25000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Increased Cost Endorsement", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "36630", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Theft Expense Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Claim Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Advance Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "Freedom Mortgage Corp ISAOA ATIMA",
  },

  // =========================================================================
  // AUTO-OWNERS — Robin Anthony & Clarence E Anthony
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "54-450-957-00",
    namedInsureds: ["Robin Anthony", "Clarence E Anthony"],
    mailTo: { name: "Robin Anthony", street: "3823 Stella Rd", city: "Patrick Springs", stateCode: "VA", postalCode: "24133" },
    property: { street: "3823 Stella Rd", city: "Patrick Springs", stateCode: "VA", postalCode: "24133", county: "Patrick" },
    effectiveDate: "04/23/2025",
    expirationDate: "04/23/2026",
    premium: "1734.84",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["17536 (12-23)", "57482 (08-13)", "67107 (12-22)", "17542 (12-23)", "17743 (02-11)", "17139 (12-23)", "17552 (12-23)", "57471 (12-23)", "57442 (08-15)", "57721 (06-16)", "57724 (01-22)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)", "57845 (07-18)", "57823 (12-23)", "17866 (12-04)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "497500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "49750", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "394310", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "99500", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Homeowners Plus", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Backup of Sewers or Drains", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Other Structures Additional Limit - Garage", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Special Personal Property Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Increased Cost Endorsement", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "49750", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Theft Expense Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Equipment Breakdown Coverage", coverageCode: null, limitAmount: "100000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Service Line Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Home/Auto Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Protective Devices Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Paid In Full Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Mortgage Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Advance Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // AUTO-OWNERS — Tara K Archer & Edward O Archer
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "54-996-449-00",
    namedInsureds: ["Tara K Archer", "Edward O Archer"],
    mailTo: { name: "Tara K Archer", street: "2617 Elk Valley Rd", city: "Forest", stateCode: "VA", postalCode: "24551" },
    property: { street: "2617 Elk Valley Rd", city: "Forest", stateCode: "VA", postalCode: "24551", county: "Bedford" },
    effectiveDate: "01/30/2026",
    expirationDate: "01/30/2027",
    premium: "2783.73",
    deductible: "1500",
    policyFormCode: "HO-3",
    forms: ["17536 (12-23)", "57532 (08-13)", "57482 (08-13)", "17542 (12-23)", "57442 (08-15)", "17729 (12-23)", "17552 (12-23)", "57471 (12-23)", "67122 (12-23)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)", "57845 (07-18)", "57823 (12-23)", "67166 (07-24)", "67138 (12-23)", "17866 (12-04)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "537500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "53750", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "376250", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "107500", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Homeowners Plus", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Backup of Sewers or Drains", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "537500", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Increased Cost Endorsement", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Theft Expense Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Interior Matching Protection", coverageCode: null, limitAmount: "53750", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Protective Devices Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Claim Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "Quicken Loans Inc ISAOA",
  },

  // =========================================================================
  // AUTO-OWNERS — Wildon Adkins
  // =========================================================================
  {
    carrierSlug: "auto-owners",
    policyNumber: "53-270-144-01",
    namedInsureds: ["Wildon Adkins"],
    mailTo: { name: "Wildon Adkins", street: "1108 Nature Ln", city: "Union Hall", stateCode: "VA", postalCode: "24176" },
    property: { street: "1108 Nature Ln", city: "Union Hall", stateCode: "VA", postalCode: "24176", county: "Franklin" },
    effectiveDate: "03/15/2026",
    expirationDate: "03/15/2027",
    premium: "1980.42",
    deductible: "2500",
    policyFormCode: "HO-3",
    forms: ["17536 (12-23)", "57482 (08-13)", "17542 (12-23)", "17748 (12-23)", "17743 (02-11)", "57471 (12-23)", "57442 (08-15)", "17716 (07-14)", "57023 (08-13)", "57902 (03-19)", "57845 (07-18)", "57823 (12-23)", "67166 (07-24)", "67138 (12-23)", "17866 (12-04)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "501500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "50150", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "308714", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Additional Living Expense", coverageCode: "D", limitAmount: "100300", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Homeowners Plus", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Backup of Sewers or Drains", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Guaranteed Home Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Other Structures Additional Limit - Dock", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Credit and Fund Transfer Card Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "50150", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Theft Expense Coverage", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Fire Department Charges", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Home/Auto Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Paid In Full Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Mortgage Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Claim Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Billy Joe Cole
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-1800-5613",
    namedInsureds: ["Billy Joe Cole"],
    mailTo: { name: "Billy Joe Cole", street: "PO Box 864", city: "Fieldale", stateCode: "VA", postalCode: "24089" },
    property: { street: "182 Saddleridge Rd", city: "Bassett", stateCode: "VA", postalCode: "24055", county: "Henry" },
    effectiveDate: "11/16/2025",
    expirationDate: "11/16/2026",
    premium: "1141.06",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HO 00 03 03 22", "UPCIC 45 01 11 23", "HO 23 72 07 23", "IL P 052 01 13", "UPCIC 45 06 05 20"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "253284", premiumAmount: "1058.20", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "25336", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "177299", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "50657", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: "24.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "5000", premiumAmount: "11.00", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: "177299", premiumAmount: "128.73", premiumText: null },
      { section: "OPTIONAL", label: "Age of Home Surcharge", coverageCode: null, limitAmount: null, premiumAmount: "113.50", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: "-95.36", premiumText: null },
      { section: "CREDIT", label: "Loyalty Discount", coverageCode: null, limitAmount: null, premiumAmount: "-124.01", premiumText: null },
    ],
    mortgagee: "Rocket Mortgage, LLC ISAOA",
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Brenda Tyree
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-2500-1513",
    namedInsureds: ["Brenda Tyree"],
    mailTo: { name: "Brenda Tyree", street: "1108 Tyree Street", city: "Lynchburg", stateCode: "VA", postalCode: "24502" },
    property: { street: "1108 Tyree St", city: "Lynchburg", stateCode: "VA", postalCode: "24504", county: "Lynchburg City" },
    effectiveDate: "04/04/2026",
    expirationDate: "04/04/2027",
    premium: "719.88",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HO 00 03 03 22", "UPCIC 45 01 11 23", "UPCIC 45 51 11 23", "UPCIC 45 53 11 23", "HO 04 98 03 22", "HO 23 65 12 23", "HO 23 72 07 23", "IL P 052 01 13", "UPCIC 45 06 05 20"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "137957", premiumAmount: "593.62", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "13797", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "96570", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "27592", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: "24.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: "0.00", premiumText: null },
      { section: "OPTIONAL", label: "Specified Additional Amount of Insurance (25%)", coverageCode: null, limitAmount: "34489", premiumAmount: "18.26", premiumText: null },
      { section: "OPTIONAL", label: "Water Back-Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "20000", premiumAmount: "81.60", premiumText: null },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "500", premiumAmount: "11.00", premiumText: null },
      { section: "OPTIONAL", label: "Coverage C Increased Special Limits of Liability", coverageCode: null, limitAmount: null, premiumAmount: "24.00", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: "96570", premiumAmount: "75.61", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: "-56.00", premiumText: null },
      { section: "CREDIT", label: "Loyalty Discount", coverageCode: null, limitAmount: null, premiumAmount: "-77.21", premiumText: null },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Candace Anthony & Joby Anthony III
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-2500-5118",
    namedInsureds: ["Candace Anthony", "Joby Anthony III"],
    mailTo: { name: "Candace Anthony", street: "308 Woodberry Lane", city: "Lynchburg", stateCode: "VA", postalCode: "24502" },
    property: { street: "308 Woodberry Ln", city: "Lynchburg", stateCode: "VA", postalCode: "24502", county: "Bedford" },
    effectiveDate: "11/14/2025",
    expirationDate: "11/14/2026",
    premium: "937.17",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HO 00 03 03 22", "UPCIC 45 01 11 23", "UPCIC 45 51 11 23", "UPCIC 45 53 11 23", "HO 04 98 03 22", "HO 23 65 12 23", "HO 23 72 07 23", "IL P 052 01 13", "UPCIC 45 06 05 20"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "263656", premiumAmount: "820.04", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "26366", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "184560", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "52732", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: "24.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: "0.00", premiumText: null },
      { section: "OPTIONAL", label: "Specified Additional Amount of Insurance (25%)", coverageCode: null, limitAmount: "65914", premiumAmount: "25.73", premiumText: null },
      { section: "OPTIONAL", label: "Water Back-Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "10000", premiumAmount: "61.75", premiumText: null },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "500", premiumAmount: "11.00", premiumText: null },
      { section: "OPTIONAL", label: "Coverage C Increased Special Limits of Liability", coverageCode: null, limitAmount: null, premiumAmount: "18.00", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: "184560", premiumAmount: "97.28", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "OPTIONAL", label: "Inspection Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: "-72.06", premiumText: null },
      { section: "CREDIT", label: "Prior Insurance Discount", coverageCode: null, limitAmount: null, premiumAmount: "-98.57", premiumText: null },
    ],
    mortgagee: "Lakeview Loan Servicing, LLC c/o Mr Cooper",
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Cheryl Walters
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-2500-2494",
    namedInsureds: ["Cheryl Walters"],
    mailTo: { name: "Cheryl Walters", street: "368 Old Henry Rd", city: "Henry", stateCode: "VA", postalCode: "24102" },
    property: { street: "368 Old Henry Rd", city: "Henry", stateCode: "VA", postalCode: "24102", county: "Franklin" },
    effectiveDate: "05/23/2025",
    expirationDate: "05/23/2026",
    premium: "1453.03",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HO 00 03 03 22", "UPCIC 45 01 11 23", "UPCIC 45 54 11 23", "HO 23 72 07 23", "UPCIC 45 88 11 23", "IL P 052 01 13", "UPCIC 45 06 05 20"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "266500", premiumAmount: "1206.76", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "26650", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "186550", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "53300", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "100000", premiumAmount: "0.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: "0.00", premiumText: null },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "66625", premiumAmount: "31.21", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: "186550", premiumAmount: "144.67", premiumText: null },
      { section: "OPTIONAL", label: "Premises Alarm or Fire Protection System", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Age of Home Surcharge", coverageCode: null, limitAmount: null, premiumAmount: "127.55", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "OPTIONAL", label: "Inspection Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: "-107.16", premiumText: null },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Dana Silver
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-1800-4041",
    namedInsureds: ["Dana Silver"],
    mailTo: { name: "Dana Silver", street: "23 Hidden Forest Dr", city: "Martinsville", stateCode: "VA", postalCode: "24112" },
    property: { street: "23 Hidden Forest Dr", city: "Martinsville", stateCode: "VA", postalCode: "24112", county: "Henry" },
    effectiveDate: "08/01/2025",
    expirationDate: "08/01/2026",
    premium: "1259.39",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HO 00 03 03 22", "UPCIC 45 01 11 23", "HO 23 72 07 23", "IL P 052 01 13", "UPCIC 45 06 05 20"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "261929", premiumAmount: "1171.43", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "26199", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "184660", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "52386", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: "24.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "5000", premiumAmount: "11.00", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: "184660", premiumAmount: "142.08", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Increase", coverageCode: null, limitAmount: "184660", premiumAmount: "3.01", premiumText: null },
      { section: "OPTIONAL", label: "Age of Home Surcharge", coverageCode: null, limitAmount: null, premiumAmount: "125.26", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: "-105.24", premiumText: null },
      { section: "CREDIT", label: "Loyalty Discount", coverageCode: null, limitAmount: null, premiumAmount: "-137.15", premiumText: null },
    ],
    mortgagee: "Navy Federal Credit Union ISAOA",
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Doris Mann
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-2500-6803",
    namedInsureds: ["Doris Mann"],
    mailTo: { name: "Doris Mann", street: "1124 Stratford Rd", city: "Lynchburg", stateCode: "VA", postalCode: "24502" },
    property: { street: "1124 Stratford Rd", city: "Lynchburg", stateCode: "VA", postalCode: "24502", county: "Lynchburg City" },
    effectiveDate: "12/31/2025",
    expirationDate: "12/31/2026",
    premium: "998.42",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HO 00 03 03 22", "UPCIC 45 01 11 23", "UPCIC 45 32 11 23", "UPCIC 45 51 11 23", "UPCIC 45 54 11 23", "HO 23 72 07 23", "HO 03 13 07 23", "UPCIC 45 39 11 23", "IL P 052 01 13", "UPCIC 45 06 05 20"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "162035", premiumAmount: "819.01", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "16204", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "81018", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "32407", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: "24.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: "0.00", premiumText: null },
      { section: "OPTIONAL", label: "Loss Assessment Coverage", coverageCode: null, limitAmount: "5000", premiumAmount: "5.00", premiumText: null },
      { section: "OPTIONAL", label: "Specified Additional Amount of Insurance (25%)", coverageCode: null, limitAmount: "40509", premiumAmount: "28.64", premiumText: null },
      { section: "OPTIONAL", label: "Ordinance or Law Coverage", coverageCode: null, limitAmount: "40509", premiumAmount: "18.52", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: "81018", premiumAmount: "119.22", premiumText: null },
      { section: "OPTIONAL", label: "Windstorm or Hail Percentage Deductible", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Injury Coverage", coverageCode: null, limitAmount: null, premiumAmount: "12.00", premiumText: null },
      { section: "OPTIONAL", label: "Age of Home Surcharge", coverageCode: null, limitAmount: null, premiumAmount: "98.31", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "OPTIONAL", label: "Inspection Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Age of Occupant Discount", coverageCode: null, limitAmount: null, premiumAmount: "-70.90", premiumText: null },
      { section: "CREDIT", label: "Prior Insurance Discount", coverageCode: null, limitAmount: null, premiumAmount: "-105.38", premiumText: null },
    ],
    mortgagee: "TRUIST BANK, ISAOA/ATIMA",
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Erica Shay Young
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-1800-0730",
    namedInsureds: ["Erica Shay Young"],
    mailTo: { name: "Erica Shay Young", street: "177 Wilson Ave", city: "Martinsville", stateCode: "VA", postalCode: "24112" },
    property: { street: "177 Wilson Ave", city: "Martinsville", stateCode: "VA", postalCode: "24112", county: "Henry" },
    effectiveDate: "03/02/2026",
    expirationDate: "03/02/2027",
    premium: "1271.45",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HO 00 03 03 22", "UPCIC 45 01 11 23", "IL P 052 01 13", "UPCIC 45 06 05 20"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "240612", premiumAmount: "1345.81", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "24070", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "120306", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "48123", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: "24.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "5000", premiumAmount: "11.00", premiumText: null },
      { section: "OPTIONAL", label: "Age of Home Surcharge", coverageCode: null, limitAmount: null, premiumAmount: "122.03", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: "-117.90", premiumText: null },
      { section: "CREDIT", label: "Loyalty Discount", coverageCode: null, limitAmount: null, premiumAmount: "-138.49", premiumText: null },
    ],
    mortgagee: "Flagstar Bank ISAOA/ATIMA",
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Jo Whitmore
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-2500-4070",
    namedInsureds: ["Jo Whitmore"],
    mailTo: { name: "Jo Whitmore", street: "3808 Moorman Drive", city: "Lynchburg", stateCode: "VA", postalCode: "24501" },
    property: { street: "3808 Moorman Dr", city: "Lynchburg", stateCode: "VA", postalCode: "24501", county: "Lynchburg City" },
    effectiveDate: "08/17/2025",
    expirationDate: "08/17/2026",
    premium: "784.38",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HO 00 03 03 22", "UPCIC 45 01 11 23", "UPCIC 45 51 11 23", "UPCIC 45 53 11 23", "HO 04 98 03 22", "HO 23 72 07 23", "IL P 052 01 13", "UPCIC 45 06 05 20"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "192176", premiumAmount: "616.04", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "19218", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "134524", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "38436", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: "24.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: "0.00", premiumText: null },
      { section: "OPTIONAL", label: "Specified Additional Amount of Insurance (25%)", coverageCode: null, limitAmount: "48044", premiumAmount: "18.91", premiumText: null },
      { section: "OPTIONAL", label: "Water Back-Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "10000", premiumAmount: "61.75", premiumText: null },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "500", premiumAmount: "11.00", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: "134524", premiumAmount: "74.72", premiumText: null },
      { section: "OPTIONAL", label: "Age of Home Surcharge", coverageCode: null, limitAmount: null, premiumAmount: "64.91", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "OPTIONAL", label: "Inspection Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: "-55.35", premiumText: null },
      { section: "CREDIT", label: "Prior Insurance Discount", coverageCode: null, limitAmount: null, premiumAmount: "-81.60", premiumText: null },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // UNIVERSAL PROPERTY — Mark & Robin Zimmerman
  // =========================================================================
  {
    carrierSlug: "universal-property",
    policyNumber: "7501-2400-1556",
    namedInsureds: ["Mark Zimmerman", "Robin Zimmerman"],
    mailTo: { name: "Mark Zimmerman", street: "205 Beverly Hills Circle", city: "Lynchburg", stateCode: "VA", postalCode: "24502" },
    property: { street: "205 Beverly Hills Cir", city: "Lynchburg", stateCode: "VA", postalCode: "24502", county: "Lynchburg City" },
    effectiveDate: "05/11/2025",
    expirationDate: "05/11/2026",
    premium: "976.39",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HO 00 03 03 22", "UPCIC 45 01 11 23", "UPCIC 45 51 11 23", "UPCIC 45 53 11 23", "HO 04 98 03 22", "HO 23 72 07 23", "IL P 052 01 13", "UPCIC 45 06 05 20"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "326791", premiumAmount: "824.63", premiumText: null },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "32681", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "228754", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "65359", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: "24.00", premiumText: null },
      { section: "LIABILITY", label: "F. Medical Payments", coverageCode: "F", limitAmount: "1000", premiumAmount: "0.00", premiumText: null },
      { section: "OPTIONAL", label: "Specified Additional Amount of Insurance (25%)", coverageCode: null, limitAmount: "81698", premiumAmount: "25.26", premiumText: null },
      { section: "OPTIONAL", label: "Water Back-Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "10000", premiumAmount: "61.75", premiumText: null },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "500", premiumAmount: "11.00", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: "228754", premiumAmount: "91.52", premiumText: null },
      { section: "OPTIONAL", label: "Age of Home Surcharge", coverageCode: null, limitAmount: null, premiumAmount: "86.73", premiumText: null },
      { section: "OPTIONAL", label: "MGA Fee", coverageCode: null, limitAmount: null, premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: "-67.79", premiumText: null },
      { section: "CREDIT", label: "Loyalty Discount", coverageCode: null, limitAmount: null, premiumAmount: "-105.71", premiumText: null },
    ],
    mortgagee: "FREEDOM MORTGAGE CORPORATION ISAOA/ATIMA",
  },

  // =========================================================================
  // TRAVELERS — Carl & Mary Svalstedt
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "611242078-633-1",
    namedInsureds: ["Carl Svalstedt", "Mary Svalstedt"],
    mailTo: { name: "Carl Svalstedt", street: "142 Tanzalon Dr", city: "Lynchburg", stateCode: "VA", postalCode: "24502" },
    property: { street: "142 Tanzalon Dr", city: "Lynchburg", stateCode: "VA", postalCode: "24502", county: "Lynchburg City" },
    effectiveDate: "03/04/2026",
    expirationDate: "03/04/2027",
    premium: "2834.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)", "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)", "HQ-015 VA (04-23)", "HQ-082 HO (04-23)", "HQ-290 VA (04-23)", "HQ-420 VA (04-23)", "HQ-498 CW (05-17)", "HQ-700 VA (05-18)", "HQ-208 HO (04-23)", "HQ-209 VA (04-23)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "430000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "43000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "215000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "86000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Special Personal Property Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Injury Coverage", coverageCode: null, limitAmount: null, premiumAmount: "16.00", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection", coverageCode: null, limitAmount: "215000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "500", premiumAmount: "16.00", premiumText: null },
      { section: "OPTIONAL", label: "Matching of Undamaged Roof Surfacing", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Back Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Limited Hidden Water or Steam Seepage", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "Carrington Mtg Svcs LLC ISAOA ATIMA",
  },

  // =========================================================================
  // TRAVELERS — Craig & Kelly Lowell
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "618255792-633-1",
    namedInsureds: ["Craig Lowell", "Kelly Lowell"],
    mailTo: { name: "Craig Lowell", street: "1036 Morey Pl", city: "Lynchburg", stateCode: "VA", postalCode: "24502" },
    property: { street: "1036 Morey Pl", city: "Lynchburg", stateCode: "VA", postalCode: "24502", county: "Lynchburg City" },
    effectiveDate: "12/27/2025",
    expirationDate: "12/27/2026",
    premium: "971.00",
    deductible: "2500",
    policyFormCode: "HO-3",
    forms: ["HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)", "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)", "HQ-208 HO (04-23)", "HQ-290 VA (04-23)", "HQ-312 CW (05-17)", "HQ-420 VA (04-23)", "HQ-498 CW (05-17)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "386000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "38600", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "289500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "77200", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Back Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "25000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Windstorm or Hail Percentage Deductible (1%)", coverageCode: null, limitAmount: "3860", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection", coverageCode: null, limitAmount: "193000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "500", premiumAmount: "16.00", premiumText: null },
      { section: "CREDIT", label: "Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Fire Protective Device Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "Freedom First FCU",
  },

  // =========================================================================
  // TRAVELERS — Ryan & Elizabeth Glavas
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "618307957-633-1",
    namedInsureds: ["Ryan Glavas", "Elizabeth Glavas"],
    mailTo: { name: "Ryan Glavas", street: "1271 Church St", city: "Appomattox", stateCode: "VA", postalCode: "24522" },
    property: { street: "1271 Church St", city: "Appomattox", stateCode: "VA", postalCode: "24522", county: "Appomattox" },
    effectiveDate: "01/30/2026",
    expirationDate: "01/30/2027",
    premium: "1962.00",
    deductible: "2500",
    policyFormCode: "HO-3",
    forms: ["HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)", "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)", "HQ-277 HO (04-23)", "HQ-290 VA (04-23)", "HQ-310 CW (05-17)", "HQ-312 CW (05-17)", "HQ-420 VA (04-23)", "HQ-498 CW (05-17)", "HQ-208 HO (04-23)", "HQ-209 VA (04-23)", "HQ-855 CW (05-17)", "HQ-856 CW (08-20)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "477000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "47700", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "238500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "95400", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Expanded Ordinance or Law", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Windstorm or Hail Percentage Deductible (1%)", coverageCode: null, limitAmount: "4770", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection", coverageCode: null, limitAmount: "238500", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "500", premiumAmount: "16.00", premiumText: null },
      { section: "OPTIONAL", label: "Water Back Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Limited Hidden Water or Steam Seepage", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Equipment Breakdown Coverage", coverageCode: null, limitAmount: "50000", premiumAmount: "84.00", premiumText: null },
      { section: "OPTIONAL", label: "Buried Utility Lines Coverage", coverageCode: null, limitAmount: "20000", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "Freedom First Credit Union ISAOA/ATIMA",
  },

  // =========================================================================
  // TRAVELERS — David Dow
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "618398974-633-1",
    namedInsureds: ["David Dow"],
    mailTo: { name: "David Dow", street: "97670 Marina Heights Loop", city: "Brookings", stateCode: "OR", postalCode: "97415" },
    property: { street: "603 Kings Rd", city: "Lynchburg", stateCode: "VA", postalCode: "24502", county: "Lynchburg City" },
    effectiveDate: "03/01/2026",
    expirationDate: "03/01/2027",
    premium: "1428.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)", "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)", "HQ-208 HO (04-23)", "HQ-290 VA (04-23)", "HQ-420 VA (04-23)", "HQ-455 CW (08-20)", "HQ-498 CW (05-17)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "329000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "32900", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "164500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "65800", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Back Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection", coverageCode: null, limitAmount: "164500", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Fraud Expense Reimbursement", coverageCode: null, limitAmount: "25000", premiumAmount: "25.00", premiumText: null },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "500", premiumAmount: "16.00", premiumText: null },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // TRAVELERS — John Buckner
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "618296452-633-1",
    namedInsureds: ["John Buckner"],
    mailTo: { name: "John Buckner", street: "868 Sandy Bottom Rd", city: "Ringgold", stateCode: "VA", postalCode: "24586" },
    property: { street: "868 Sandy Bottom Rd", city: "Ringgold", stateCode: "VA", postalCode: "24586", county: "Pittsylvania" },
    effectiveDate: "01/09/2026",
    expirationDate: "01/09/2027",
    premium: "1230.00",
    deductible: "2500",
    policyFormCode: "HO-3",
    forms: ["HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)", "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)", "HQ-082 HO (04-23)", "HQ-208 HO (04-23)", "HQ-290 VA (04-23)", "HQ-420 VA (04-23)", "HQ-455 CW (08-20)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "217000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "21700", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "108500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "43400", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Injury Coverage", coverageCode: null, limitAmount: null, premiumAmount: "14.00", premiumText: null },
      { section: "OPTIONAL", label: "Water Back Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection", coverageCode: null, limitAmount: "108500", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Fraud Expense Reimbursement", coverageCode: null, limitAmount: "25000", premiumAmount: "25.00", premiumText: null },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Fire Protective Device Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "Truist Bank ISAOA/ATIMA",
  },

  // =========================================================================
  // TRAVELERS — Shawnte Perkins
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "618253602-633-1",
    namedInsureds: ["Shawnte Perkins"],
    mailTo: { name: "Shawnte Perkins", street: "408 Northpointe Ln Apt 303", city: "Danville", stateCode: "VA", postalCode: "24540" },
    property: { street: "204 Seminole Dr", city: "Danville", stateCode: "VA", postalCode: "24540", county: "Danville City" },
    effectiveDate: "12/23/2025",
    expirationDate: "12/23/2026",
    premium: "594.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)", "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)", "HQ-082 HO (04-23)", "HQ-208 HO (04-23)", "HQ-290 VA (04-23)", "HQ-420 VA (04-23)", "HQ-455 CW (08-20)", "HQ-700 VA (05-18)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "194000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "19400", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "97000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "38800", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "300000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Injury Coverage", coverageCode: null, limitAmount: null, premiumAmount: "14.00", premiumText: null },
      { section: "OPTIONAL", label: "Water Back Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection", coverageCode: null, limitAmount: "97000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Fraud Expense Reimbursement", coverageCode: null, limitAmount: "25000", premiumAmount: "25.00", premiumText: null },
      { section: "OPTIONAL", label: "Matching of Undamaged Roof Surfacing", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Fire Protective Device Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: "City of Danville County Habitat for Humanity",
  },

  // =========================================================================
  // TRAVELERS — Vonetta Medrano
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "618393160-633-1",
    namedInsureds: ["Vonetta Medrano"],
    mailTo: { name: "Vonetta Medrano", street: "944 Hutson Rd", city: "Dry Fork", stateCode: "VA", postalCode: "24549" },
    property: { street: "944 Hutson Rd", city: "Dry Fork", stateCode: "VA", postalCode: "24549", county: "Pittsylvania" },
    effectiveDate: "02/12/2026",
    expirationDate: "02/12/2027",
    premium: "2923.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)", "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)", "HQ-208 HO (04-23)", "HQ-290 VA (04-23)", "HQ-420 VA (04-23)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "238000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "23800", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "119000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "47600", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Back Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection", coverageCode: null, limitAmount: "119000", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // TRAVELERS — William & Margaret Cummins
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "618446668-633-1",
    namedInsureds: ["William Cummins", "Margaret Cummins"],
    mailTo: { name: "William Cummins", street: "117 Woodland Dr", city: "Amherst", stateCode: "VA", postalCode: "24521" },
    property: { street: "117 Woodland Dr", city: "Amherst", stateCode: "VA", postalCode: "24521", county: "Amherst" },
    effectiveDate: "03/13/2026",
    expirationDate: "03/13/2027",
    premium: "904.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)", "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)", "HQ-015 VA (04-23)", "HQ-082 HO (04-23)", "HQ-290 VA (04-23)", "HQ-420 VA (04-23)", "HQ-455 CW (08-20)", "HQ-498 CW (05-17)", "HQ-851 CW (05-17)", "HQ-852 CW (05-17)", "HQ-853 VA (04-23)", "HQ-854 CW (05-17)", "HQ-901 CW (11-18)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "284000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "28400", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "142000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "56800", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "2000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Premier Additional Coverage Package", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Special Personal Property Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Injury Coverage", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection (100%)", coverageCode: null, limitAmount: "284000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Fraud Expense Reimbursement", coverageCode: null, limitAmount: "25000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Refrigerated Property Coverage", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Lock Replacement Coverage", coverageCode: null, limitAmount: "1000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Reward Coverage", coverageCode: null, limitAmount: "2500", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Business Records and Data Replacement", coverageCode: null, limitAmount: "15000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Land Stabilization Coverage", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Home Settlement Benefit", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Loss Assessment Increased Limit", coverageCode: null, limitAmount: "50000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Ordinance or Law (100%)", coverageCode: null, limitAmount: "284000", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Fire Protective Device Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // TRAVELERS — Youlanda Delgado & Antonio Serna Medina
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyNumber: "618308866-633-1",
    namedInsureds: ["Youlanda Delgado", "Antonio Serna Medina"],
    mailTo: { name: "Youlanda Delgado", street: "369 Orphanage Rd", city: "Danville", stateCode: "VA", postalCode: "24540" },
    property: { street: "369 Orphanage Rd", city: "Danville", stateCode: "VA", postalCode: "24540", county: "Danville City" },
    effectiveDate: "01/25/2026",
    expirationDate: "01/25/2027",
    premium: "938.00",
    deductible: "1000",
    policyFormCode: "HO-3",
    forms: ["HQ-T77 VA (11-18)", "HQ-D77 VA (04-23)", "HQ-P03 VA (04-23)", "HQ-L77 VA (04-23)", "HQ-S99 CW (05-17)", "HQ-300 HO (04-23)", "HQ-860 CW (08-18)", "HQ-082 HO (04-23)", "HQ-290 VA (04-23)", "HQ-420 VA (04-23)", "HQ-455 CW (08-20)", "HQ-700 VA (05-18)", "HQ-208 HO (04-23)", "HQ-209 VA (04-23)"],
    coverages: [
      { section: "PROPERTY", label: "A. Dwelling", coverageCode: "A", limitAmount: "309000", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "B. Other Structures", coverageCode: "B", limitAmount: "30900", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "C. Personal Property", coverageCode: "C", limitAmount: "154500", premiumAmount: null, premiumText: "Incl." },
      { section: "PROPERTY", label: "D. Loss of Use", coverageCode: "D", limitAmount: "61800", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "E. Personal Liability", coverageCode: "E", limitAmount: "500000", premiumAmount: null, premiumText: "Incl." },
      { section: "LIABILITY", label: "F. Medical Payments to Others", coverageCode: "F", limitAmount: "2000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Injury Coverage", coverageCode: null, limitAmount: null, premiumAmount: "16.00", premiumText: null },
      { section: "OPTIONAL", label: "Personal Property Replacement Cost", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Additional Replacement Cost Protection", coverageCode: null, limitAmount: "154500", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Identity Fraud Expense Reimbursement", coverageCode: null, limitAmount: "25000", premiumAmount: "25.00", premiumText: null },
      { section: "OPTIONAL", label: "Matching of Undamaged Roof Surfacing", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Water Back Up and Sump Discharge or Overflow", coverageCode: null, limitAmount: "10000", premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Limited Hidden Water or Steam Seepage", coverageCode: null, limitAmount: "5000", premiumAmount: null, premiumText: "Incl." },
      { section: "CREDIT", label: "Multi-Policy Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Early Quote Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Loss Free Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
    ],
    mortgagee: null,
  },

  // =========================================================================
  // TRAVELERS — John Pantana (PERSONAL AUTO)
  // =========================================================================
  {
    carrierSlug: "travelers",
    policyTypeCode: "PERSONAL_AUTO",
    policyNumber: "606445235-203-1",
    namedInsureds: ["John Pantana"],
    mailTo: { name: "John Pantana", street: "1423 Lakepointe Dr", city: "Forest", stateCode: "VA", postalCode: "24551" },
    property: { street: "1423 Lakepointe Dr", city: "Forest", stateCode: "VA", postalCode: "24551", county: "Bedford" },
    effectiveDate: "10/10/2025",
    expirationDate: "04/10/2026",
    premium: "14916",
    deductible: "500",
    policyFormCode: "PAP",
    forms: [
      "G01VA05 (11-24)", "L01VA01 (11-21)", "M01VA02 (11-21)", "U01VA02 (07-23)",
      "P01VA02 (11-21)", "S01CW01 (10-13)", "E1OVA00 (10-13)", "E1RVA00 (10-13)",
      "E1SVA01 (05-19)", "E1VVA00 (10-13)", "E2UVA00 (11-21)",
    ],
    coverages: [
      // --- Vehicle 1: 2024 Tesla Model X LO ---
      { section: "LIABILITY", label: "Veh 1 (2024 Tesla Model X LO) - Bodily Injury ($250K/$500K)", coverageCode: "BI", limitAmount: "250000", premiumAmount: "505", premiumText: null },
      { section: "LIABILITY", label: "Veh 1 (2024 Tesla Model X LO) - Property Damage", coverageCode: "PD", limitAmount: "100000", premiumAmount: "308", premiumText: null },
      { section: "LIABILITY", label: "Veh 1 (2024 Tesla Model X LO) - Medical Expense", coverageCode: "MED", limitAmount: "2000", premiumAmount: "33", premiumText: null },
      { section: "LIABILITY", label: "Veh 1 (2024 Tesla Model X LO) - Uninsured Motorist BI ($250K/$500K)", coverageCode: "UM", limitAmount: "250000", premiumAmount: "82", premiumText: null },
      { section: "LIABILITY", label: "Veh 1 (2024 Tesla Model X LO) - Uninsured Motorist PD", coverageCode: "UMPD", limitAmount: "100000", premiumAmount: "4", premiumText: null },
      { section: "PROPERTY", label: "Veh 1 (2024 Tesla Model X LO) - Collision ($500 ded)", coverageCode: "COLL", limitAmount: null, premiumAmount: "1815", premiumText: null },
      { section: "PROPERTY", label: "Veh 1 (2024 Tesla Model X LO) - Comprehensive ($500 ded)", coverageCode: "COMP", limitAmount: null, premiumAmount: "355", premiumText: null },
      // --- Vehicle 2: 2019 Mercedes-Benz Sprinter ---
      { section: "LIABILITY", label: "Veh 2 (2019 Mercedes-Benz Sprinter) - Bodily Injury ($250K/$500K)", coverageCode: "BI", limitAmount: "250000", premiumAmount: "312", premiumText: null },
      { section: "LIABILITY", label: "Veh 2 (2019 Mercedes-Benz Sprinter) - Property Damage", coverageCode: "PD", limitAmount: "100000", premiumAmount: "217", premiumText: null },
      { section: "LIABILITY", label: "Veh 2 (2019 Mercedes-Benz Sprinter) - Medical Expense", coverageCode: "MED", limitAmount: "2000", premiumAmount: "24", premiumText: null },
      { section: "LIABILITY", label: "Veh 2 (2019 Mercedes-Benz Sprinter) - Uninsured Motorist BI ($250K/$500K)", coverageCode: "UM", limitAmount: "250000", premiumAmount: "62", premiumText: null },
      { section: "LIABILITY", label: "Veh 2 (2019 Mercedes-Benz Sprinter) - Uninsured Motorist PD", coverageCode: "UMPD", limitAmount: "100000", premiumAmount: "3", premiumText: null },
      { section: "PROPERTY", label: "Veh 2 (2019 Mercedes-Benz Sprinter) - Collision ($500 ded)", coverageCode: "COLL", limitAmount: null, premiumAmount: "812", premiumText: null },
      { section: "PROPERTY", label: "Veh 2 (2019 Mercedes-Benz Sprinter) - Comprehensive ($500 ded)", coverageCode: "COMP", limitAmount: null, premiumAmount: "428", premiumText: null },
      // --- Vehicle 3: 2021 Tesla Model Y PE ---
      { section: "LIABILITY", label: "Veh 3 (2021 Tesla Model Y PE) - Bodily Injury ($250K/$500K)", coverageCode: "BI", limitAmount: "250000", premiumAmount: "420", premiumText: null },
      { section: "LIABILITY", label: "Veh 3 (2021 Tesla Model Y PE) - Property Damage", coverageCode: "PD", limitAmount: "100000", premiumAmount: "182", premiumText: null },
      { section: "LIABILITY", label: "Veh 3 (2021 Tesla Model Y PE) - Medical Expense", coverageCode: "MED", limitAmount: "2000", premiumAmount: "25", premiumText: null },
      { section: "LIABILITY", label: "Veh 3 (2021 Tesla Model Y PE) - Uninsured Motorist BI ($250K/$500K)", coverageCode: "UM", limitAmount: "250000", premiumAmount: "67", premiumText: null },
      { section: "LIABILITY", label: "Veh 3 (2021 Tesla Model Y PE) - Uninsured Motorist PD", coverageCode: "UMPD", limitAmount: "100000", premiumAmount: "3", premiumText: null },
      { section: "PROPERTY", label: "Veh 3 (2021 Tesla Model Y PE) - Collision ($500 ded)", coverageCode: "COLL", limitAmount: null, premiumAmount: "824", premiumText: null },
      { section: "PROPERTY", label: "Veh 3 (2021 Tesla Model Y PE) - Comprehensive ($500 ded)", coverageCode: "COMP", limitAmount: null, premiumAmount: "222", premiumText: null },
      // --- Vehicle 4: 2015 Volkswagen Golf ---
      { section: "LIABILITY", label: "Veh 4 (2015 Volkswagen Golf) - Bodily Injury ($250K/$500K)", coverageCode: "BI", limitAmount: "250000", premiumAmount: "387", premiumText: null },
      { section: "LIABILITY", label: "Veh 4 (2015 Volkswagen Golf) - Property Damage", coverageCode: "PD", limitAmount: "100000", premiumAmount: "274", premiumText: null },
      { section: "LIABILITY", label: "Veh 4 (2015 Volkswagen Golf) - Medical Expense", coverageCode: "MED", limitAmount: "2000", premiumAmount: "23", premiumText: null },
      { section: "LIABILITY", label: "Veh 4 (2015 Volkswagen Golf) - Uninsured Motorist BI ($250K/$500K)", coverageCode: "UM", limitAmount: "250000", premiumAmount: "66", premiumText: null },
      { section: "LIABILITY", label: "Veh 4 (2015 Volkswagen Golf) - Uninsured Motorist PD", coverageCode: "UMPD", limitAmount: "100000", premiumAmount: "3", premiumText: null },
      { section: "PROPERTY", label: "Veh 4 (2015 Volkswagen Golf) - Collision ($500 ded)", coverageCode: "COLL", limitAmount: null, premiumAmount: "303", premiumText: null },
      { section: "PROPERTY", label: "Veh 4 (2015 Volkswagen Golf) - Comprehensive ($500 ded)", coverageCode: "COMP", limitAmount: null, premiumAmount: "77", premiumText: null },
      // --- Vehicle 5: 2018 Tesla Model S 75 ---
      { section: "LIABILITY", label: "Veh 5 (2018 Tesla Model S 75) - Bodily Injury ($250K/$500K)", coverageCode: "BI", limitAmount: "250000", premiumAmount: "484", premiumText: null },
      { section: "LIABILITY", label: "Veh 5 (2018 Tesla Model S 75) - Property Damage", coverageCode: "PD", limitAmount: "100000", premiumAmount: "263", premiumText: null },
      { section: "LIABILITY", label: "Veh 5 (2018 Tesla Model S 75) - Medical Expense", coverageCode: "MED", limitAmount: "2000", premiumAmount: "25", premiumText: null },
      { section: "LIABILITY", label: "Veh 5 (2018 Tesla Model S 75) - Uninsured Motorist BI ($250K/$500K)", coverageCode: "UM", limitAmount: "250000", premiumAmount: "70", premiumText: null },
      { section: "LIABILITY", label: "Veh 5 (2018 Tesla Model S 75) - Uninsured Motorist PD", coverageCode: "UMPD", limitAmount: "100000", premiumAmount: "3", premiumText: null },
      { section: "PROPERTY", label: "Veh 5 (2018 Tesla Model S 75) - Collision ($500 ded)", coverageCode: "COLL", limitAmount: null, premiumAmount: "1075", premiumText: null },
      { section: "PROPERTY", label: "Veh 5 (2018 Tesla Model S 75) - Comprehensive ($500 ded)", coverageCode: "COMP", limitAmount: null, premiumAmount: "183", premiumText: null },
      // --- Vehicle 6: 2022 Tesla Model 3 LO ---
      { section: "LIABILITY", label: "Veh 6 (2022 Tesla Model 3 LO) - Bodily Injury ($250K/$500K)", coverageCode: "BI", limitAmount: "250000", premiumAmount: "769", premiumText: null },
      { section: "LIABILITY", label: "Veh 6 (2022 Tesla Model 3 LO) - Property Damage", coverageCode: "PD", limitAmount: "100000", premiumAmount: "384", premiumText: null },
      { section: "LIABILITY", label: "Veh 6 (2022 Tesla Model 3 LO) - Medical Expense", coverageCode: "MED", limitAmount: "2000", premiumAmount: "35", premiumText: null },
      { section: "LIABILITY", label: "Veh 6 (2022 Tesla Model 3 LO) - Uninsured Motorist BI ($250K/$500K)", coverageCode: "UM", limitAmount: "250000", premiumAmount: "73", premiumText: null },
      { section: "LIABILITY", label: "Veh 6 (2022 Tesla Model 3 LO) - Uninsured Motorist PD", coverageCode: "UMPD", limitAmount: "100000", premiumAmount: "3", premiumText: null },
      { section: "PROPERTY", label: "Veh 6 (2022 Tesla Model 3 LO) - Collision ($500 ded)", coverageCode: "COLL", limitAmount: null, premiumAmount: "1559", premiumText: null },
      { section: "PROPERTY", label: "Veh 6 (2022 Tesla Model 3 LO) - Comprehensive ($500 ded)", coverageCode: "COMP", limitAmount: null, premiumAmount: "210", premiumText: null },
      // --- Endorsements ---
      { section: "OPTIONAL", label: "Glass Deductible ($50) - All Vehicles", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Incl." },
      { section: "OPTIONAL", label: "Personal Property Coverage ($500) - Veh 1,2,4,5,6", coverageCode: null, limitAmount: "500", premiumAmount: null, premiumText: "Pkg" },
      { section: "OPTIONAL", label: "Roadside Assistance Coverage ($300) - Veh 1,2,4,5,6", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Pkg" },
      { section: "OPTIONAL", label: "Trip Interruption Coverage - Veh 1,2,4,5,6", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Pkg" },
      // --- Packages ---
      { section: "OPTIONAL", label: "Premier Roadside Assistance - Veh 1", coverageCode: null, limitAmount: null, premiumAmount: "10", premiumText: null },
      { section: "OPTIONAL", label: "Premier Roadside Assistance - Veh 2", coverageCode: null, limitAmount: null, premiumAmount: "10", premiumText: null },
      { section: "OPTIONAL", label: "Premier Roadside Assistance - Veh 4", coverageCode: null, limitAmount: null, premiumAmount: "10", premiumText: null },
      { section: "OPTIONAL", label: "Premier Roadside Assistance - Veh 5", coverageCode: null, limitAmount: null, premiumAmount: "10", premiumText: null },
      { section: "OPTIONAL", label: "Premier Roadside Assistance - Veh 6", coverageCode: null, limitAmount: null, premiumAmount: "10", premiumText: null },
      { section: "OPTIONAL", label: "Responsible Driver Plan", coverageCode: null, limitAmount: null, premiumAmount: "1894", premiumText: null },
      { section: "OPTIONAL", label: "Accident Forgiveness", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Pkg" },
      { section: "OPTIONAL", label: "Minor Violation Forgiveness", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Pkg" },
      // --- Discounts ---
      { section: "CREDIT", label: "Multi-Policy & Home Ownership Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Multi-Car Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Paid in Full Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Payer Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "EFT Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Continuous Insurance Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "New Car Discount (Veh 1)", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Electric Vehicle Discount (Veh 1,3,5,6)", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Good Student Discount (Tripper, Isabella)", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Digital Auto Discount", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
      { section: "CREDIT", label: "Automatic Emergency Braking Discount (Veh 2,3,5,6)", coverageCode: null, limitAmount: null, premiumAmount: null, premiumText: "Applied" },
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
  const suffix = policyNumber.replace(/[-\s]/g, "").slice(-4);
  return `${lastName}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const agency = await prisma.agency.findUnique({ where: { slug: "blue-ridge-insurance" } });
  if (!agency) throw new Error("Agency 'blue-ridge-insurance' not found. Run seed-demo.ts first.");

  const virginia = await prisma.state.findUnique({ where: { code: "VA" } });
  if (!virginia) throw new Error("State VA not found.");

  // Preload policy types
  const policyTypeMap = new Map<string, { id: string; code: string }>();
  for (const code of ["HOMEOWNERS", "PERSONAL_AUTO"]) {
    const pt = await prisma.policyType.findUnique({ where: { code } });
    if (!pt) throw new Error(`Policy type ${code} not found.`);
    policyTypeMap.set(code, pt);
  }

  // Preload carriers and ensure agency appointments exist
  const carrierMap = new Map<string, { id: string; name: string }>();
  const carrierSlugs = [...new Set(records.map((r) => r.carrierSlug))];
  for (const slug of carrierSlugs) {
    const carrier = await prisma.carrier.findUnique({ where: { slug } });
    if (!carrier) throw new Error(`Carrier '${slug}' not found.`);
    carrierMap.set(slug, carrier);

    // Ensure carrier appointment exists for the agency
    await prisma.agencyCarrierAppointment.upsert({
      where: { agencyId_carrierId_stateId: { agencyId: agency.id, carrierId: carrier.id, stateId: virginia.id } },
      update: {},
      create: { agencyId: agency.id, carrierId: carrier.id, stateId: virginia.id },
    });
  }

  console.log("Importing insured records from other carrier dec pages...\n");

  for (const rec of records) {
    const carrier = carrierMap.get(rec.carrierSlug)!;
    const policyType = policyTypeMap.get(rec.policyTypeCode || "HOMEOWNERS")!;
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

    // Create policy
    const policy = await prisma.policy.upsert({
      where: { agencyId_policyNumber: { agencyId: agency.id, policyNumber: rec.policyNumber } },
      update: {
        insuredAccountId: account.id,
        policyTypeId: policyType.id,
        carrierId: carrier.id,
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
        extractedCarrierName: carrier.name,
        readinessSource: "DECLARATION_PAGE",
        readinessConfirmedAt: new Date(),
      },
      create: {
        agencyId: agency.id,
        insuredAccountId: account.id,
        policyTypeId: policyType.id,
        carrierId: carrier.id,
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
        extractedCarrierName: carrier.name,
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

    console.log(`  + [${carrier.name}] ${displayName} (${accountCode}) -- policy ${rec.policyNumber}, ${rec.coverages.length} coverages, ${rec.forms.length} forms`);
  }

  console.log(`\nImported ${records.length} policies across 4 carriers (Auto-Owners, Cincinnati, Universal Property, Travelers) — Homeowners + Personal Auto.`);
}

main()
  .then(() => disconnectPrisma())
  .catch(async (e) => {
    console.error(e);
    await disconnectPrisma();
    process.exit(1);
  });
