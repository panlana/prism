/**
 * Seed dec page extraction hints for known carriers.
 *
 * Usage: npx tsx setup/seed-extraction-hints.ts
 */
import { prisma } from "./seed-utils.js";

interface HintSeed {
  carrierSlug: string;
  stateCode: string;
  policyTypeCode: string;
  hints: string;
}

const hints: HintSeed[] = [
  {
    carrierSlug: "augusta-mutual",
    stateCode: "VA",
    policyTypeCode: "HOMEOWNERS",
    hints: `This is an Augusta Mutual Insurance Company (AMIC) homeowners declaration page from Virginia.

Layout notes:
- The top of the page has three columns: "Mail To" (left), "Named Insured" (center), "Agency" (right).
- The "Mail To" address may differ from the named insured — extract both.
- The policy number appears near the top, sometimes as plain digits (e.g. "4037055") or hyphenated (e.g. "10-2018-7367").
- The effective and expiration dates appear on the same line, formatted as MM/DD/YYYY.
- The property address appears in a section labeled "Location" or "Property Location" and may include a county.

Coverage section:
- Coverage amounts are listed as Coverage A through Coverage F with dollar amounts.
- The annual premium appears labeled as "Total Policy Premium" or "Annual Premium".
- The deductible is typically listed near the coverages, sometimes labeled "All Peril Deductible".

Forms section:
- The forms list appears at the bottom, with references like "FORM 3 (2.1)", "AM-400 (04/15)", "HO 1744 (07/23)".
- FORM 1 = Basic (HO-1), FORM 2 = Broad (HO-2), FORM 3 = Special (HO-3), FORM 4 = Tenants, FORM 5 = Comprehensive (HO-5).
- Look for "Policy Form" or "Std Form" references in the rating section to identify the base form.

Mortgagee:
- The mortgagee (if any) appears in a dedicated section, often labeled "Mortgagee" or "Loss Payee".`,
  },
  {
    carrierSlug: "travelers",
    stateCode: "VA",
    policyTypeCode: "HOMEOWNERS",
    hints: `This is a Travelers homeowners declaration page.

Layout notes:
- Travelers dec pages are part of a multi-page packet. The actual declaration data may start on page 2-5 after cover letters.
- Look for the page with "DECLARATIONS" or "HOMEOWNERS POLICY DECLARATIONS" header.
- The named insured and mailing address appear at the top left.
- The policy number format is typically alphanumeric (e.g. "680-xxxxx-xxxx").

Coverage section:
- Coverages are listed in a structured table: Coverage A (Dwelling), B (Other Structures), C (Personal Property), D (Loss of Use), E (Personal Liability), F (Medical Payments).
- Each coverage line shows the limit amount.
- The premium breakdown may be on a separate page.

Forms section:
- Travelers uses standard ISO form numbers (e.g. "HO 00 03 05 11" for HO-3).
- The forms list may span multiple pages.
- Look for "Forms and Endorsements" section.`,
  },
  {
    carrierSlug: "cincinnati",
    stateCode: "VA",
    policyTypeCode: "HOMEOWNERS",
    hints: `This is a Cincinnati Casualty Company "Executive Select" homeowners declaration page from Virginia.

Layout notes:
- The dec is a 3-page document with "The Cincinnati Casualty Company" header and bridge logo.
- Page 1: Policy number (e.g. "H01 1303671"), named insured & address, agency info, county, billing info, total premium.
- The "COVERAGES AND LIMITS OF INSURANCE" section is on page 1 with Section I (A-D) and Section II (E-F).
- Multiple deductibles may apply: a base all-perils deductible, plus percentage deductibles for Landslide and Earthquake.
- Page 2: Credits applied (listed by name only, no amounts), BASIC PREMIUM SUBTOTAL, then "OTHER COVERAGES, ENDORSEMENTS AND CHARGES" with form numbers (e.g. "HR783NA (1/22)") and individual premiums.
- Page 3: Schedule details for Equipment Breakdown, Cyber Protection, Increased Assessments, Water Damage, Flood, Service Line. Also lists First Mortgagee info.

Coverage section:
- Section I lists A. Dwelling, B. Other Structures, C. Personal Property, D. Loss of Use with limits.
- Section II lists E. Personal Liability (with BI/PD per occurrence and Personal Injury aggregate as one limit) and F. Medical Payments.
- The "Executive Select" endorsement is the base policy form — this is a premium homeowners product.

Forms section:
- Form numbers use Cincinnati's naming: HR-prefixed (e.g. HR783NA, HR1024VA) plus MI-prefixed notices.
- Each endorsement line shows the form number and edition date in parentheses.`,
  },
  {
    carrierSlug: "auto-owners",
    stateCode: "VA",
    policyTypeCode: "HOMEOWNERS",
    hints: `This is an Auto-Owners Insurance Company homeowners declaration page from Virginia.

Layout notes:
- Auto-Owners dec page packets are 14-16 pages. The actual declarations are on pages 13-14 (form 17560).
- Page 13 (Page 1 of dec): Header with Auto-Owners logo, agency info, insured name/address, policy number, term dates, company bill info.
- The "LOCATION DESCRIPTION" section shows the property address, construction type, roof type, year built, protection class, and notes "Special Form 3 Policy" for HO-3.
- "PROPERTY AND LIABILITY COVERAGES" table lists A through F with limits. F (Medical Payments) shows "each person/each accident" format (e.g. "5,000/100,000").
- "Section I Deductible" lists multiple deductibles: Earthquake (percentage), Windstorm or Hail (dollar), All Other Peril (dollar).
- "COVERAGES THAT APPLY" lists all optional coverages with limits where applicable. Many show as included without separate premium amounts. Auto-Owners bundles coverages into the total premium.
- Page 14 (Page 2 of dec): "PREMIUM DISCOUNTS THAT APPLY" lists discount names (no individual amounts). "TOTAL LOCATION PREMIUM" and "TOTAL POLICY PREMIUM" shown. "Forms That Apply To This Location" and "Forms That Apply To All Locations" list form numbers like "17536 (12-23)".

Coverage section:
- Coverages are bundled into total premium — individual coverage premiums are not broken out.
- Optional coverages include: Personal Property Replacement Cost, Homeowners Plus (bundles several sub-coverages), Water Backup, Guaranteed Home Replacement Cost, Special Personal Property, Earthquake, Equipment Breakdown, Service Line, Identity Theft, Ordinance or Law, Undamaged Siding or Roofing, Loss Assessment, Fire Department Charges.

Forms section:
- Form numbers are 5-digit codes with edition dates: e.g. "17536 (12-23)", "57471 (12-23)".
- Forms are split into "location" forms and "all locations" forms.`,
  },
  {
    carrierSlug: "universal-property",
    stateCode: "VA",
    policyTypeCode: "HOMEOWNERS",
    hints: `This is a Universal Property & Casualty Insurance Company homeowners declaration page from Virginia.

Layout notes:
- The dec is a 2-page document with "Universal Property" logo and "Declaration Effective" date at top.
- Page 1: Policy number, FROM/TO dates, insured billed type, agent code. Named insured & address on left, agent on right.
- "Insured Location" shows the property address with county.
- "Premium Summary" shows: Basic Coverages Premium, Attached Endorsements Premium, Assessments/Surcharges, MGA Fees/Policy Fees, and Total Policy Premium.
- "Rating Information" table shows Form (HO3), Construction, Year Built, Townhouse, Number of Families, Occupied, Protection Class, Territory, BCEG, County, Dwelling/Personal Property Replacement Cost flags, Protective Device Credits.
- "COVERAGES - SECTION I" table: Coverage A (Dwelling) with limit and premium, Coverage B (Other Structures) limit, Coverage C (Personal Property) limit, Coverage D (Loss of Use) limit.
- "COVERAGES - SECTION II" table: Coverage E (Personal Liability) with limit and premium, Coverage F (Medical Payments) with limit and premium.
- Deductible line: "Section I coverages subject to X% - $Y all perils deductible per loss."

- Page 2: "Additional Interest" section (mortgagee info — may be empty).
- "Policy Forms and Endorsements Applicable to this Policy" table with NUMBER, EDITION, DESCRIPTION, LIMITS, PREMIUMS columns.
- Each endorsement line shows form number, description, and premium (positive for charges, negative in parens for discounts).
- Discounts like "Loss Free Discount", "Loyalty Discount" appear as negative premium entries.
- "Age of Home" surcharge appears as positive premium.
- "MGA Fee" is listed separately.`,
  },
  {
    carrierSlug: "travelers",
    stateCode: "VA",
    policyTypeCode: "PERSONAL_AUTO",
    hints: `This is a Travelers Personal Security Insurance Company personal auto declaration page from Virginia.

Layout notes:
- Travelers auto dec page packets are 20+ pages. The actual declarations start after ID cards and feature info pages.
- Look for "Automobile Policy Continuation Declarations" header.
- Item 1: Named insured, address, policy number, account number, agency info.
- Item 2: Total premium and policy period (may be 6-month or 12-month term).
- Item 3: Vehicle list with year/make/model and VINs.
- Item 4: "Coverages, Limits of Liability and Premiums" — the core coverage section.
  - Split across multiple pages, grouped by vehicles (e.g., "Vehicle(s) 1-4" then "Vehicle(s) 5-6").
  - Each vehicle column shows premium for: A. Bodily Injury, B. Property Damage, C. Medical Expense, D. Uninsured Motorist, D2. Uninsured Motorist PD, E. Collision, F. Comprehensive.
  - Endorsements (Glass Deductible, Personal Property, Roadside Assistance, Trip Interruption) show "Incl" or "Pkg".
  - "OTHER PREMIUM" section shows policy-level features (Accident Forgiveness, Minor Violation Forgiveness) as "Pkg".
  - "Package Premiums" section shows Premier Roadside Assistance per vehicle and Responsible Driver Plan.
  - Vehicle subtotals and total premium at the end.
- Item 5: "Information Used to Rate Your Policy" — discounts, drivers (DOB, gender, marital status), vehicles (use, mileage, location), driving history.
- Item 6: "Other Information" — insurer name, forms list with form numbers and descriptions.

Coverage section:
- Liability limits are the same for all vehicles (stated once per coverage).
- Premiums differ per vehicle based on rating factors.
- Collision and Comprehensive show deductible amounts and per-vehicle premiums.
- "Pkg" means included in a package premium (e.g., Premier Roadside Assistance).

Forms section:
- Travelers auto forms use alphanumeric codes: G01VA05 (General Provisions), L01VA01 (Liability), M01VA02 (Medical), U01VA02 (UM), P01VA02 (Physical Damage), S01CW01 (Signature), E-prefixed (endorsements).
- Form numbers include edition dates in parentheses.`,
  },
];

async function main() {
  console.log("Seeding dec page extraction hints...");

  for (const hint of hints) {
    const carrier = await prisma.carrier.findUnique({ where: { slug: hint.carrierSlug } });
    if (!carrier) {
      console.log(`  ! Carrier "${hint.carrierSlug}" not found, skipping.`);
      continue;
    }

    const state = await prisma.state.findUnique({ where: { code: hint.stateCode } });
    if (!state) {
      console.log(`  ! State "${hint.stateCode}" not found, skipping.`);
      continue;
    }

    const policyType = await prisma.policyType.findUnique({ where: { code: hint.policyTypeCode } });
    if (!policyType) {
      console.log(`  ! Policy type "${hint.policyTypeCode}" not found, skipping.`);
      continue;
    }

    await prisma.carrierPolicyOffering.upsert({
      where: {
        carrierId_stateId_policyTypeId: {
          carrierId: carrier.id,
          stateId: state.id,
          policyTypeId: policyType.id,
        },
      },
      update: { decExtractionHints: hint.hints },
      create: {
        carrierId: carrier.id,
        stateId: state.id,
        policyTypeId: policyType.id,
        decExtractionHints: hint.hints,
      },
    });

    console.log(`  ✓ ${carrier.name} / ${hint.stateCode} / ${hint.policyTypeCode}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
