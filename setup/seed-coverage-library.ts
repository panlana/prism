import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "./seed-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXTRACTED_DIR = join(
  __dirname,
  "../docs/Prism/extracted/nationwide/va/homeowners"
);

// ---------------------------------------------------------------------------
// Coverage categories — broad groupings for canonical coverages
// ---------------------------------------------------------------------------

const categories = [
  { code: "property", name: "Property Coverages", description: "Coverages protecting the dwelling, structures, and personal property", sortOrder: 1 },
  { code: "liability", name: "Liability Coverages", description: "Coverages protecting against legal liability for injuries or damage", sortOrder: 2 },
  { code: "additional", name: "Additional Coverages", description: "Supplemental coverages beyond the base policy", sortOrder: 3 },
  { code: "deductible_modifier", name: "Deductible Modifiers", description: "Endorsements that alter deductible structures", sortOrder: 4 },
  { code: "valuation", name: "Valuation & Settlement", description: "Endorsements affecting how losses are valued and settled", sortOrder: 5 },
  { code: "administrative", name: "Administrative", description: "Non-coverage endorsements (company provisions, program enrollment)", sortOrder: 6 },
];

// ---------------------------------------------------------------------------
// Canonical coverage definitions — carrier-agnostic concepts
// Derived from canonical_suggestions.json but enriched for the database
// ---------------------------------------------------------------------------

const canonicalCoverages: Array<{
  code: string;
  categoryCode: string;
  policyTypeCode: string;
  name: string;
  definition: string;
  riskSummary: string;
  aliasOne?: string;
  isCommonlyRecommended: boolean;
}> = [
  {
    code: "dwelling",
    categoryCode: "property",
    policyTypeCode: "HOMEOWNERS",
    name: "Dwelling",
    aliasOne: "Coverage A",
    definition: "Protects the home structure against covered causes of loss.",
    riskSummary: "Base policy coverage for the physical dwelling. Limit should reflect full replacement cost.",
    isCommonlyRecommended: false,
  },
  {
    code: "other_structures",
    categoryCode: "property",
    policyTypeCode: "HOMEOWNERS",
    name: "Other Structures",
    aliasOne: "Coverage B",
    definition: "Covers structures on the property that are separate from the dwelling, such as detached garages, fences, and sheds.",
    riskSummary: "Typically 10% of Coverage A. May need increase for large outbuildings.",
    isCommonlyRecommended: false,
  },
  {
    code: "personal_property",
    categoryCode: "property",
    policyTypeCode: "HOMEOWNERS",
    name: "Personal Property",
    aliasOne: "Coverage C",
    definition: "Covers personal belongings inside and outside the home against covered perils.",
    riskSummary: "Typically 50-70% of Coverage A. Special sub-limits apply to jewelry, electronics, etc.",
    isCommonlyRecommended: false,
  },
  {
    code: "loss_of_use",
    categoryCode: "property",
    policyTypeCode: "HOMEOWNERS",
    name: "Loss of Use",
    aliasOne: "Coverage D",
    definition: "Pays additional living expenses if the home is uninhabitable due to a covered loss.",
    riskSummary: "Covers hotel, meals, and other expenses while the home is being repaired.",
    isCommonlyRecommended: false,
  },
  {
    code: "personal_liability",
    categoryCode: "liability",
    policyTypeCode: "HOMEOWNERS",
    name: "Personal Liability",
    aliasOne: "Coverage E",
    definition: "Provides liability protection if someone is injured on your property or you cause damage to others.",
    riskSummary: "Base policy coverage. Agency may recommend higher limits or umbrella policy.",
    isCommonlyRecommended: false,
  },
  {
    code: "medical_payments",
    categoryCode: "liability",
    policyTypeCode: "HOMEOWNERS",
    name: "Medical Payments to Others",
    aliasOne: "Coverage F",
    definition: "Pays medical expenses for guests injured on the property regardless of fault.",
    riskSummary: "No-fault coverage for minor injuries. Typically $1,000-$5,000 per person.",
    isCommonlyRecommended: false,
  },
  {
    code: "water_backup",
    categoryCode: "additional",
    policyTypeCode: "HOMEOWNERS",
    name: "Water Backup & Sump Discharge",
    aliasOne: "Sewer Backup Coverage",
    definition: "Covers damage from water backing up through sewers, drains, or overflowing from sump pumps.",
    riskSummary: "Base policy excludes sewer/drain backup. One of the most common claims. Typically $5,000-$25,000 sublimit.",
    isCommonlyRecommended: true,
  },
  {
    code: "earthquake",
    categoryCode: "additional",
    policyTypeCode: "HOMEOWNERS",
    name: "Earthquake Coverage",
    definition: "Covers direct physical loss caused by earthquake, including land shock waves and volcanic tremors.",
    riskSummary: "Base policy excludes earth movement. Uses percentage-based deductible. Important in seismic zones.",
    isCommonlyRecommended: false,
  },
  {
    code: "earthquake_loss_assessment",
    categoryCode: "additional",
    policyTypeCode: "HOMEOWNERS",
    name: "Earthquake Loss Assessment",
    definition: "Covers the insured's share of earthquake loss assessments from property owner associations.",
    riskSummary: "Relevant for condo/HOA owners in earthquake-prone areas. Separate from direct earthquake coverage.",
    isCommonlyRecommended: false,
  },
  {
    code: "ordinance_or_law",
    categoryCode: "additional",
    policyTypeCode: "HOMEOWNERS",
    name: "Ordinance or Law Coverage",
    definition: "Covers increased costs to rebuild to current building codes after a covered loss.",
    riskSummary: "Base policy has limited ordinance/law coverage. Enhanced version provides a percentage of Coverage A for code-mandated upgrades.",
    isCommonlyRecommended: true,
  },
  {
    code: "personal_injury",
    categoryCode: "liability",
    policyTypeCode: "HOMEOWNERS",
    name: "Personal Injury Coverage",
    definition: "Extends liability coverage to include offenses like libel, slander, false arrest, wrongful eviction, and invasion of privacy.",
    riskSummary: "Base Section II liability doesn't cover defamation or privacy claims. Adds important protection for personal offenses.",
    isCommonlyRecommended: true,
  },
  {
    code: "equipment_breakdown",
    categoryCode: "additional",
    policyTypeCode: "HOMEOWNERS",
    name: "Equipment Breakdown Coverage",
    definition: "Covers mechanical, electrical, and electronic equipment failures including HVAC, appliances, and home systems.",
    riskSummary: "Base policy covers sudden/accidental damage but excludes mechanical breakdown. Includes expediting, spoilage, and green improvement sub-coverages.",
    isCommonlyRecommended: true,
  },
  {
    code: "identity_theft",
    categoryCode: "additional",
    policyTypeCode: "HOMEOWNERS",
    name: "Identity Theft Expense Coverage",
    definition: "Reimburses expenses incurred as a result of identity theft or identity fraud.",
    riskSummary: "Covers lost income, attorney fees, notary costs, and administrative expenses. Typically $25,000 limit with no deductible.",
    isCommonlyRecommended: true,
  },
  {
    code: "replacement_cost_contents",
    categoryCode: "valuation",
    policyTypeCode: "HOMEOWNERS",
    name: "Replacement Cost — Personal Property",
    aliasOne: "Brand New Belongings",
    definition: "Upgrades personal property loss settlement from actual cash value to replacement cost.",
    riskSummary: "Without this, claims are paid at depreciated value. With it, you get the cost of a new equivalent item.",
    isCommonlyRecommended: true,
  },
  {
    code: "extended_dwelling_replacement",
    categoryCode: "valuation",
    policyTypeCode: "HOMEOWNERS",
    name: "Extended Dwelling Replacement Cost",
    aliasOne: "Dwelling Replacement Cost — 200%",
    definition: "Extends dwelling loss settlement up to 200% of Coverage A limit for replacement cost overruns.",
    riskSummary: "Protects against construction cost spikes. If rebuilding costs more than Coverage A, this pays up to double.",
    isCommonlyRecommended: true,
  },
  {
    code: "better_roof_replacement",
    categoryCode: "valuation",
    policyTypeCode: "HOMEOWNERS",
    name: "Better Roof Replacement",
    definition: "Pays for upgraded roofing materials meeting ASTM/UL standards when full roof replacement is required.",
    riskSummary: "Upgrades to impact-resistant, wind-resistant roofing instead of like-kind replacement.",
    isCommonlyRecommended: false,
  },
  {
    code: "windstorm_hail_deductible",
    categoryCode: "deductible_modifier",
    policyTypeCode: "HOMEOWNERS",
    name: "Windstorm or Hail Deductible",
    definition: "Establishes a separate deductible for windstorm and hail losses, often as a percentage of Coverage A.",
    riskSummary: "Applies to hurricanes, named storms, tornadoes, and convection storms. May be higher than the standard deductible.",
    isCommonlyRecommended: false,
  },
  {
    code: "home_protection_program",
    categoryCode: "administrative",
    policyTypeCode: "HOMEOWNERS",
    name: "Home Protection Program",
    definition: "Provides smart home safety devices and monitoring services to eligible policyholders.",
    riskSummary: "Value-added program offering water leak detection, fire monitoring, and security devices. Not a traditional coverage.",
    isCommonlyRecommended: false,
  },
  {
    code: "mutual_policy_conditions",
    categoryCode: "administrative",
    policyTypeCode: "HOMEOWNERS",
    name: "Mutual Policy Conditions",
    definition: "Administrative endorsement adding mutual company membership provisions and applicable contract law terms.",
    riskSummary: "Required for policies issued by Nationwide Mutual. Not a coverage enhancement.",
    isCommonlyRecommended: false,
  },
  {
    code: "protection_boost",
    categoryCode: "additional",
    policyTypeCode: "HOMEOWNERS",
    name: "Protection Boost",
    aliasOne: "Enhanced Limits Package",
    definition: "Bundled endorsement that increases multiple special limits, enhances debris removal, and broadens watercraft liability.",
    riskSummary: "Raises sub-limits for jewelry, firearms, money, securities. Increases debris removal from 5% to 20%. Bundled value play.",
    isCommonlyRecommended: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(EXTRACTED_DIR, filename), "utf-8")) as T;
}

type MetadataEntry = {
  filename: string;
  form_code: string;
  title: string;
  form_type: string;
  state: string | null;
  edition_date: string | null;
  modifies_forms: string[];
  modifies_description: string | null;
};

type SectionFile = {
  form_filename: string;
  sections: Array<{
    id: string;
    section_ref: string;
    title: string;
    section_type: string;
    parent_id: string | null;
    sort_order: number;
    content: string;
  }>;
};

type ModificationEntry = {
  endorsement_filename: string;
  modifications: Array<{
    endorsement_section_id: string;
    base_policy_section_ref: string;
    base_policy_section_title: string;
    modification_type: string;
    summary: string;
  }>;
};

type CanonicalSuggestion = {
  endorsement_filename: string;
  suggested_canonical_code: string | null;
  is_bundle: boolean;
  bundle_concepts: Array<{ code: string }>;
};

// ---------------------------------------------------------------------------
// Main ingestion
// ---------------------------------------------------------------------------

export async function seedCoverageLibrary() {
  console.log("Seeding coverage categories...");
  for (const cat of categories) {
    await prisma.coverageCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, description: cat.description, sortOrder: cat.sortOrder },
      create: cat,
    });
  }

  console.log("Seeding canonical coverage definitions...");
  for (const cov of canonicalCoverages) {
    const category = await prisma.coverageCategory.findUniqueOrThrow({
      where: { code: cov.categoryCode },
    });
    const policyType = await prisma.policyType.findUniqueOrThrow({
      where: { code: cov.policyTypeCode },
    });

    await prisma.coverageDefinition.upsert({
      where: { code: cov.code },
      update: {
        categoryId: category.id,
        policyTypeId: policyType.id,
        name: cov.name,
        aliasOne: cov.aliasOne ?? null,
        definition: cov.definition,
        riskSummary: cov.riskSummary,
        isCommonlyRecommended: cov.isCommonlyRecommended,
      },
      create: {
        code: cov.code,
        categoryId: category.id,
        policyTypeId: policyType.id,
        name: cov.name,
        aliasOne: cov.aliasOne ?? null,
        definition: cov.definition,
        riskSummary: cov.riskSummary,
        isCommonlyRecommended: cov.isCommonlyRecommended,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Ingest Nationwide VA Homeowners forms from extracted data
  // -----------------------------------------------------------------------

  console.log("Reading extracted form data...");
  const metadata = readJson<MetadataEntry[]>("metadata.json");
  const modifications = readJson<ModificationEntry[]>("modifications.json");
  const canonicalSuggestions = readJson<CanonicalSuggestion[]>("canonical_suggestions.json");

  // Read all section files
  const sectionFiles: SectionFile[] = [];
  const sectionsDir = join(EXTRACTED_DIR, "sections");
  for (const file of readdirSync(sectionsDir).filter((f) => f.endsWith(".json"))) {
    sectionFiles.push(
      JSON.parse(readFileSync(join(sectionsDir, file), "utf-8")) as SectionFile
    );
  }

  // Look up the offering (Nationwide + VA + Homeowners)
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { slug: "nationwide" } });
  const state = await prisma.state.findUniqueOrThrow({ where: { code: "VA" } });
  const policyType = await prisma.policyType.findUniqueOrThrow({ where: { code: "HOMEOWNERS" } });

  const offering = await prisma.carrierPolicyOffering.upsert({
    where: {
      carrierId_stateId_policyTypeId: {
        carrierId: carrier.id,
        stateId: state.id,
        policyTypeId: policyType.id,
      },
    },
    update: {},
    create: {
      carrierId: carrier.id,
      stateId: state.id,
      policyTypeId: policyType.id,
    },
  });

  // Clear existing forms for this offering so we can re-ingest cleanly
  // (cascade will remove sections, modifications, and coverage mappings)
  await prisma.offeringForm.deleteMany({ where: { offeringId: offering.id } });

  console.log("Ingesting forms...");
  // Map from extraction filename → database form ID (for section/modification linking)
  const formIdByFilename = new Map<string, string>();

  for (const meta of metadata) {
    const kind =
      meta.form_type === "base_policy"
        ? "BASE_POLICY"
        : meta.form_type === "endorsement"
          ? "ENDORSEMENT"
          : "OTHER";

    // Read the full extracted text
    let extractedText: string | null = null;
    try {
      extractedText = readFileSync(
        join(EXTRACTED_DIR, meta.filename),
        "utf-8"
      );
    } catch {
      // Text file may not exist for all forms
    }

    const form = await prisma.offeringForm.create({
      data: {
        offeringId: offering.id,
        title: meta.title,
        formCode: meta.form_code,
        formNumber: meta.form_code.replace(/\s+/g, ""),
        editionDate: meta.edition_date,
        kind: kind as "BASE_POLICY" | "ENDORSEMENT" | "OTHER",
        isBasePolicy: meta.form_type === "base_policy",
        pageCount:
          extractedText
            ? Math.max(1, Math.ceil(extractedText.length / 3000))
            : null,
        sourceFilename: meta.filename.replace(/\.txt$/, ".pdf"),
        extractedText,
      },
    });

    formIdByFilename.set(meta.filename, form.id);
    console.log(`  ${meta.form_code} — ${meta.title}`);
  }

  // -----------------------------------------------------------------------
  // Ingest sections
  // -----------------------------------------------------------------------

  console.log("Ingesting form sections...");
  // Map from "filename:sectionId" → database section ID (for modification linking)
  const sectionDbIdMap = new Map<string, string>();

  for (const sectionFile of sectionFiles) {
    const formId = formIdByFilename.get(sectionFile.form_filename);
    if (!formId) continue;

    // First pass: create all sections without parent links
    for (const section of sectionFile.sections) {
      const dbSection = await prisma.offeringFormSection.create({
        data: {
          offeringFormId: formId,
          sectionRef: section.section_ref,
          title: section.title,
          sectionType: section.section_type,
          content: section.content,
          sortOrder: section.sort_order,
        },
      });
      sectionDbIdMap.set(`${sectionFile.form_filename}:${section.id}`, dbSection.id);
    }

    // Second pass: set parent links
    for (const section of sectionFile.sections) {
      if (section.parent_id) {
        const childDbId = sectionDbIdMap.get(
          `${sectionFile.form_filename}:${section.id}`
        );
        const parentDbId = sectionDbIdMap.get(
          `${sectionFile.form_filename}:${section.parent_id}`
        );
        if (childDbId && parentDbId) {
          await prisma.offeringFormSection.update({
            where: { id: childDbId },
            data: { parentId: parentDbId },
          });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Ingest section modifications
  // -----------------------------------------------------------------------

  console.log("Ingesting section modifications...");
  for (const modEntry of modifications) {
    for (const mod of modEntry.modifications) {
      const sectionDbId = sectionDbIdMap.get(
        `${modEntry.endorsement_filename}:${mod.endorsement_section_id}`
      );
      if (!sectionDbId) {
        console.warn(
          `  WARN: Could not find section ${mod.endorsement_section_id} in ${modEntry.endorsement_filename}`
        );
        continue;
      }

      await prisma.sectionModification.create({
        data: {
          endorsementSectionId: sectionDbId,
          baseSectionRef: mod.base_policy_section_ref,
          baseSectionTitle: mod.base_policy_section_title,
          modificationType: mod.modification_type,
          summary: mod.summary,
        },
      });
    }
  }

  // -----------------------------------------------------------------------
  // Create FormCoverageMapping entries from canonical suggestions
  // -----------------------------------------------------------------------

  console.log("Creating coverage mappings...");
  for (const suggestion of canonicalSuggestions) {
    const formId = formIdByFilename.get(suggestion.endorsement_filename);
    if (!formId) continue;

    const codes: string[] = [];
    if (suggestion.suggested_canonical_code) {
      codes.push(suggestion.suggested_canonical_code);
    }
    if (suggestion.is_bundle) {
      for (const concept of suggestion.bundle_concepts) {
        codes.push(concept.code);
      }
    }

    for (const code of codes) {
      const coverage = await prisma.coverageDefinition.findUnique({
        where: { code },
      });
      if (!coverage) {
        console.warn(`  WARN: No canonical coverage for code "${code}", skipping`);
        continue;
      }

      await prisma.formCoverageMapping.create({
        data: {
          offeringFormId: formId,
          coverageDefinitionId: coverage.id,
        },
      });
      console.log(`  ${suggestion.endorsement_filename} → ${code}`);
    }
  }

  // Also map the base policy form to the base coverages (A–F)
  const basePolicyMeta = metadata.find((m) => m.form_type === "base_policy");
  if (basePolicyMeta) {
    const baseFormId = formIdByFilename.get(basePolicyMeta.filename);
    if (baseFormId) {
      const baseCoverageCodes = [
        "dwelling",
        "other_structures",
        "personal_property",
        "loss_of_use",
        "personal_liability",
        "medical_payments",
      ];
      for (const code of baseCoverageCodes) {
        const coverage = await prisma.coverageDefinition.findUnique({
          where: { code },
        });
        if (coverage) {
          await prisma.formCoverageMapping.create({
            data: {
              offeringFormId: baseFormId,
              coverageDefinitionId: coverage.id,
            },
          });
        }
      }
      console.log("  Base policy → A-F coverages mapped");
    }
  }

  console.log("Coverage library seeding complete.");
}

// Allow running standalone
seedCoverageLibrary()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    prisma.$disconnect();
    process.exit(1);
  });
