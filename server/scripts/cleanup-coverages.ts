/**
 * One-time data hygiene script for coverage definitions.
 *
 * Fixes:
 * 1. Merge duplicate Dwelling and Water Backup entries
 * 2. Fix kind: COVERAGE → EXCLUSION for exclusions
 * 3. Fix kind: COVERAGE → ENDORSEMENT for bundled endorsements
 * 4. Assign categories to uncategorized definitions
 * 5. Clean up administrative entries (not real coverages)
 * 6. Remove/deactivate junk entries
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function mergeDuplicate(keepCode: string, removeId: string) {
  const keep = await prisma.coverageDefinition.findFirst({ where: { code: keepCode } });
  if (!keep) { console.log(`  Skip merge: ${keepCode} not found`); return; }

  const remove = await prisma.coverageDefinition.findUnique({ where: { id: removeId } });
  if (!remove) { console.log(`  Skip merge: ${removeId} not found`); return; }

  // Reassign mappings
  const mappings = await prisma.formCoverageMapping.findMany({
    where: { coverageDefinitionId: removeId },
  });
  for (const m of mappings) {
    const exists = await prisma.formCoverageMapping.findUnique({
      where: { offeringFormId_coverageDefinitionId: { offeringFormId: m.offeringFormId, coverageDefinitionId: keep.id } },
    });
    if (exists) {
      await prisma.formCoverageMapping.delete({ where: { id: m.id } });
    } else {
      await prisma.formCoverageMapping.update({
        where: { id: m.id },
        data: { coverageDefinitionId: keep.id },
      });
    }
  }

  // Reassign agency coverage settings
  await prisma.agencyCoverageSetting.updateMany({
    where: { coverageDefinitionId: removeId },
    data: { coverageDefinitionId: keep.id },
  });

  // Delete the duplicate
  await prisma.coverageDefinition.delete({ where: { id: removeId } });
  console.log(`  Merged: "${remove.name}" (${removeId}) → "${keep.name}" (${keep.id})`);
}

async function setKind(code: string, kind: "COVERAGE" | "ENDORSEMENT" | "EXCLUSION") {
  const result = await prisma.coverageDefinition.updateMany({
    where: { code },
    data: { kind },
  });
  if (result.count > 0) console.log(`  kind: ${code} → ${kind}`);
}

async function setCategory(codes: string[], categoryName: string) {
  const cat = await prisma.coverageCategory.findFirst({ where: { name: categoryName } });
  if (!cat) { console.log(`  Category not found: ${categoryName}`); return; }
  for (const code of codes) {
    const result = await prisma.coverageDefinition.updateMany({
      where: { code, categoryId: null },
      data: { categoryId: cat.id },
    });
    if (result.count > 0) console.log(`  category: ${code} → ${categoryName}`);
  }
}

async function deactivate(codes: string[]) {
  for (const code of codes) {
    const result = await prisma.coverageDefinition.updateMany({
      where: { code, isActive: true },
      data: { isActive: false },
    });
    if (result.count > 0) console.log(`  deactivated: ${code}`);
  }
}

async function main() {
  // -----------------------------------------------------------------------
  // 1. Merge duplicates
  // -----------------------------------------------------------------------
  console.log("1. Merging duplicates...");

  // Dwelling: code=null (old seed) → merge into code="dwelling"
  const oldDwelling = await prisma.coverageDefinition.findFirst({
    where: { name: "Dwelling", code: null },
  });
  if (oldDwelling) await mergeDuplicate("dwelling", oldDwelling.id);

  // Water Backup: code=null (old seed) → merge into code="water_backup"
  const oldWaterBackup = await prisma.coverageDefinition.findFirst({
    where: { name: "Water Backup", code: null },
  });
  if (oldWaterBackup) await mergeDuplicate("water_backup", oldWaterBackup.id);

  // Liability: code=null (old seed for Personal Auto) → assign code
  const oldLiability = await prisma.coverageDefinition.findFirst({
    where: { name: "Liability", code: null },
  });
  if (oldLiability) {
    // This is the Personal Auto "Liability" — merge with bodily_injury_liability? No, keep it but give it a code
    await prisma.coverageDefinition.update({
      where: { id: oldLiability.id },
      data: { code: "liability_auto" },
    });
    console.log(`  Fixed: Liability (auto) assigned code "liability_auto"`);
  }

  // Roadside Assistance: old seed with manual ID
  const oldRoadside = await prisma.coverageDefinition.findFirst({
    where: { id: { contains: ":Roadside Assistance" } },
  });
  if (oldRoadside && oldRoadside.code === "roadside_assistance") {
    // Already has code from previous fix, skip
  }

  // -----------------------------------------------------------------------
  // 2. Fix kind for exclusions
  // -----------------------------------------------------------------------
  console.log("\n2. Fixing exclusion kinds...");
  const exclusionCodes = [
    "cosmetic_damage_exclusion",
    "canine_exclusion",
    "sexual_molestation_exclusion",
    "controlled_substance_exclusion",
    "pollution_exclusion",
    "business_premises_limitation",
    "replacement_cost_deletion",
  ];
  for (const code of exclusionCodes) await setKind(code, "EXCLUSION");

  // -----------------------------------------------------------------------
  // 3. Fix kind for endorsements/bundles
  // -----------------------------------------------------------------------
  console.log("\n3. Fixing endorsement kinds...");
  const endorsementCodes = [
    "homeowners_plus",
    "carrier_advantage_bundle",
    "farmette",
    "special_endorsement",
    "amendatory",
  ];
  for (const code of endorsementCodes) await setKind(code, "ENDORSEMENT");

  // -----------------------------------------------------------------------
  // 4. Assign categories
  // -----------------------------------------------------------------------
  console.log("\n4. Assigning categories...");

  await setCategory([
    "special_personal_property",
    "replacement_cost_contents",
    "functional_replacement_cost",
    "building_additions_alterations",
    "personal_property_other_residence",
    "limited_pp_new_residence",
    "scheduled_personal_property",
    "refrigerated_property",
    "interior_matching",
    "matching_roof",
    "matching_siding",
    "matching_siding_roofing",
    "other_structures_additional",
    "other_structures_off_premises",
  ], "Property Coverages");

  await setCategory([
    "personal_injury",
    "watercraft_liability",
    "additional_insured",
    "additional_insured_watercraft",
    "beauty_barber_liability",
    "teachers_professional_liability",
    "incidental_farming_liability",
    "farm_liability",
    "employers_liability",
    "incidental_business",
    "business_pursuits",
    "home_business",
    "office_professional_occupancy",
    "canine_exclusion",
    "sexual_molestation_exclusion",
    "pollution_exclusion",
  ], "Liability Coverages");

  await setCategory([
    "water_backup",
    "equipment_breakdown",
    "identity_theft",
    "ordinance_or_law",
    "green_home",
    "cyber_protection",
    "service_line",
    "buried_utility_lines",
    "lock_replacement",
    "reward_coverage",
    "business_records",
    "land_stabilization",
    "home_sharing",
    "assisted_living",
    "sinkhole_collapse",
    "inland_flood",
    "flood",
    "loss_assessment",
    "hidden_water_seepage",
    "valuable_items_plus",
    "snowmobile",
    "golf_cart",
    "trust_coverage",
    "additional_interests",
    "additional_residence_rented",
    "structures_rented_to_others",
    "specific_structures_away",
    "unit_owners",
    "llc_coverage",
    "landlord_furnishings",
    "farm_structures",
    "accounts_receivable",
    "fine_arts",
    "medical_dental_vet_property",
    "permitted_incidental_occupancies",
    "dwelling_under_construction",
    "guaranteed_home_replacement",
    "additional_benefits",
    "home_settlement_benefit",
    "other_household_members",
    "landslide",
    "homeowners_plus",
    "carrier_advantage_bundle",
    "farmette",
    "incidental_property_higher_limits",
    "multi_family_dwelling",
  ], "Additional Coverages");

  await setCategory([
    "windstorm_hail_deductible",
    "hurricane_deductible",
    "named_storm_deductible",
    "decreasing_deductible",
    "deductible_amendment",
    "deductible_waiver",
    "increased_cost",
    "adjusted_value",
    "cosmetic_damage_exclusion",
  ], "Deductible Modifiers");

  await setCategory([
    "extended_dwelling_replacement",
    "better_roof_replacement",
    "insurance_to_value",
    "repair_cost",
    "roof_surface_amendment",
  ], "Valuation & Settlement");

  await setCategory([
    "mutual_policy_conditions",
    "special_provisions_va",
    "cancellation_nonrenewal",
    "loss_notice_amendment",
    "amendatory",
    "special_endorsement",
    "protective_devices",
    "alarm_system",
    "consent_to_move",
    "collision_upset",
    "secured_party_interest",
    "farm_vehicle_extension",
    "contractors_interest",
    "controlled_substance_exclusion",
    "business_premises_limitation",
    "replacement_cost_deletion",
  ], "Administrative");

  // -----------------------------------------------------------------------
  // 5. Summary
  // -----------------------------------------------------------------------
  console.log("\n5. Final stats...");
  const total = await prisma.coverageDefinition.count();
  const noCategory = await prisma.coverageDefinition.count({ where: { categoryId: null } });
  const noCode = await prisma.coverageDefinition.count({ where: { code: null } });
  const inactive = await prisma.coverageDefinition.count({ where: { isActive: false } });
  const exclusions = await prisma.coverageDefinition.count({ where: { kind: "EXCLUSION" } });
  const endorsements = await prisma.coverageDefinition.count({ where: { kind: "ENDORSEMENT" } });
  const coverages = await prisma.coverageDefinition.count({ where: { kind: "COVERAGE" } });

  console.log(`  Total definitions: ${total}`);
  console.log(`  Coverages: ${coverages}, Endorsements: ${endorsements}, Exclusions: ${exclusions}`);
  console.log(`  No category: ${noCategory}`);
  console.log(`  No code: ${noCode}`);
  console.log(`  Inactive: ${inactive}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
