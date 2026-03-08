/**
 * One-time script: add obvious Personal Auto coverages and assign categories
 * to uncategorized definitions.
 *
 * Usage: npx tsx scripts/seed-auto-coverages.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const autoType = await prisma.policyType.findFirst({ where: { name: "Personal Auto" } });
  if (!autoType) throw new Error("Personal Auto policy type not found");

  // Reuse existing categories where they fit; create new ones for auto-specific groupings
  const cats = await prisma.coverageCategory.findMany();
  const catByName = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  // Create auto-specific category
  if (!catByName["Physical Damage"]) {
    const c = await prisma.coverageCategory.create({ data: { code: "physical_damage", name: "Physical Damage" } });
    catByName["Physical Damage"] = c.id;
    console.log("Created category: Physical Damage");
  }

  const liability = catByName["Liability Coverages"]!;
  const additional = catByName["Additional Coverages"]!;
  const physDamage = catByName["Physical Damage"]!;

  // Fix uncategorized Personal Auto entries
  const uncatAuto = await prisma.coverageDefinition.findMany({
    where: { policyTypeId: autoType.id, categoryId: null },
  });
  for (const def of uncatAuto) {
    let catId: string | null = null;
    if (/liability/i.test(def.name)) catId = liability;
    else if (/roadside|towing/i.test(def.name)) catId = additional;
    if (catId) {
      await prisma.coverageDefinition.update({ where: { id: def.id }, data: { categoryId: catId } });
      console.log(`Categorized: ${def.name} → ${catId === liability ? "Liability" : "Additional"}`);
    }
  }

  // Delete duplicate homeowners entries (ones without codes that duplicate coded versions)
  const dupes = await prisma.coverageDefinition.findMany({
    where: { code: null },
  });
  for (const d of dupes) {
    const hasCodedVersion = await prisma.coverageDefinition.findFirst({
      where: { code: { not: null }, name: { contains: d.name }, policyTypeId: d.policyTypeId },
    });
    if (hasCodedVersion) {
      // Check if the dupe has any mappings
      const mappingCount = await prisma.formCoverageMapping.count({
        where: { coverageDefinitionId: d.id },
      });
      if (mappingCount === 0) {
        await prisma.coverageDefinition.delete({ where: { id: d.id } });
        console.log(`Deleted duplicate: ${d.name} (${d.id})`);
      } else {
        console.log(`Skipped duplicate ${d.name} — has ${mappingCount} mapping(s)`);
      }
    }
  }

  // Standard Personal Auto coverages to add
  const autoCoverages: Array<{
    code: string;
    name: string;
    kind: "COVERAGE" | "ENDORSEMENT" | "EXCLUSION";
    categoryId: string;
    definition?: string;
    riskSummary?: string;
    isCommonlyRecommended: boolean;
  }> = [
    {
      code: "bodily_injury_liability",
      name: "Bodily Injury Liability",
      kind: "COVERAGE",
      categoryId: liability,
      definition: "Pays for injuries you cause to others in an at-fault accident, including medical bills, lost wages, and pain and suffering.",
      riskSummary: "Required in most states. Insufficient limits expose the policyholder to personal asset risk in lawsuits.",
      isCommonlyRecommended: true,
    },
    {
      code: "property_damage_liability",
      name: "Property Damage Liability",
      kind: "COVERAGE",
      categoryId: liability,
      definition: "Pays for damage you cause to another person's property (vehicle, fence, building, etc.) in an at-fault accident.",
      riskSummary: "Required in most states. Low limits can leave the insured personally liable for expensive vehicle or property damage.",
      isCommonlyRecommended: true,
    },
    {
      code: "collision",
      name: "Collision",
      kind: "COVERAGE",
      categoryId: physDamage,
      definition: "Covers damage to your vehicle from a collision with another vehicle or object, regardless of fault.",
      riskSummary: "Essential for financed/leased vehicles. Without it, the owner bears the full repair or replacement cost after an accident.",
      isCommonlyRecommended: true,
    },
    {
      code: "comprehensive",
      name: "Comprehensive",
      kind: "COVERAGE",
      categoryId: physDamage,
      definition: "Covers damage to your vehicle from non-collision events: theft, vandalism, hail, fire, falling objects, animal strikes, and natural disasters.",
      riskSummary: "Required for financed/leased vehicles. Protects against the wide range of non-collision losses that are otherwise uninsured.",
      isCommonlyRecommended: true,
    },
    {
      code: "uninsured_motorist_bi",
      name: "Uninsured Motorist — Bodily Injury",
      kind: "COVERAGE",
      categoryId: liability,
      definition: "Covers your medical expenses and lost wages when injured by a driver who carries no liability insurance.",
      riskSummary: "Roughly 1 in 8 drivers is uninsured. Without UM/BI, the policyholder has no recourse for medical costs from an uninsured at-fault driver.",
      isCommonlyRecommended: true,
    },
    {
      code: "underinsured_motorist_bi",
      name: "Underinsured Motorist — Bodily Injury",
      kind: "COVERAGE",
      categoryId: liability,
      definition: "Covers the gap when the at-fault driver's liability limits are insufficient to pay for your injuries.",
      riskSummary: "Many drivers carry state minimums. UIM fills the gap between the at-fault driver's limits and your actual damages.",
      isCommonlyRecommended: true,
    },
    {
      code: "uninsured_motorist_pd",
      name: "Uninsured Motorist — Property Damage",
      kind: "COVERAGE",
      categoryId: liability,
      definition: "Covers damage to your vehicle caused by an uninsured driver.",
      riskSummary: "Available in some states. Provides property damage protection when the at-fault party has no insurance.",
      isCommonlyRecommended: false,
    },
    {
      code: "medical_payments_auto",
      name: "Medical Payments",
      kind: "COVERAGE",
      categoryId: liability,
      definition: "Pays medical expenses for you and your passengers after an accident, regardless of who is at fault.",
      riskSummary: "No-fault coverage that fills gaps in health insurance. Covers deductibles, copays, and immediate treatment costs.",
      isCommonlyRecommended: true,
    },
    {
      code: "personal_injury_protection",
      name: "Personal Injury Protection (PIP)",
      kind: "COVERAGE",
      categoryId: liability,
      definition: "Broader than MedPay — covers medical expenses, lost wages, and essential services regardless of fault. Required in no-fault states.",
      riskSummary: "Mandatory in no-fault states. Covers a wider range of expenses than MedPay including wage loss and rehabilitation.",
      isCommonlyRecommended: true,
    },
    {
      code: "rental_reimbursement",
      name: "Rental Reimbursement",
      kind: "COVERAGE",
      categoryId: additional,
      definition: "Pays for a rental car while your vehicle is being repaired after a covered loss.",
      riskSummary: "Inexpensive add-on that prevents out-of-pocket transportation costs during potentially lengthy repairs.",
      isCommonlyRecommended: true,
    },
    {
      code: "roadside_assistance",
      name: "Roadside Assistance",
      kind: "COVERAGE",
      categoryId: additional,
      definition: "Covers towing, jump starts, flat tire changes, lockout service, and fuel delivery.",
      riskSummary: "Low-cost convenience coverage. Single tow can exceed the annual premium for this coverage.",
      isCommonlyRecommended: false,
    },
    {
      code: "gap_coverage",
      name: "Gap Coverage",
      kind: "COVERAGE",
      categoryId: additional,
      definition: "Pays the difference between your vehicle's actual cash value and the remaining loan or lease balance if the car is totaled.",
      riskSummary: "Critical for new vehicles that depreciate quickly. Without it, the owner may owe thousands after a total loss.",
      isCommonlyRecommended: true,
    },
    {
      code: "custom_equipment",
      name: "Custom Parts & Equipment",
      kind: "COVERAGE",
      categoryId: additional,
      definition: "Covers aftermarket parts and modifications (wheels, audio systems, lifts) beyond standard manufacturer equipment.",
      riskSummary: "Standard auto policies cap aftermarket coverage at low limits. Owners with modifications need this to avoid uncovered losses.",
      isCommonlyRecommended: false,
    },
    {
      code: "new_car_replacement",
      name: "New Car Replacement",
      kind: "ENDORSEMENT",
      categoryId: additional,
      definition: "If your new car is totaled within a set period, pays to replace it with the same make/model at current prices rather than depreciated value.",
      riskSummary: "Eliminates depreciation gap on newer vehicles. Especially valuable in the first 2-3 years of ownership.",
      isCommonlyRecommended: false,
    },
    {
      code: "accident_forgiveness",
      name: "Accident Forgiveness",
      kind: "ENDORSEMENT",
      categoryId: additional,
      definition: "Prevents your first at-fault accident from raising your premium at renewal.",
      riskSummary: "Rate protection endorsement. A single at-fault accident can increase premiums 20-40% without this.",
      isCommonlyRecommended: false,
    },
  ];

  let created = 0;
  let skipped = 0;
  for (const cov of autoCoverages) {
    const existing = await prisma.coverageDefinition.findFirst({
      where: { code: cov.code, policyTypeId: autoType.id },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // Also skip if there's already an entry with matching name (like the existing "Roadside Assistance")
    const byName = await prisma.coverageDefinition.findFirst({
      where: { name: cov.name, policyTypeId: autoType.id },
    });
    if (byName) {
      // Update it with the code and category if missing
      await prisma.coverageDefinition.update({
        where: { id: byName.id },
        data: {
          code: byName.code ?? cov.code,
          categoryId: byName.categoryId ?? cov.categoryId,
          definition: byName.definition ?? cov.definition,
          riskSummary: byName.riskSummary ?? cov.riskSummary,
          isCommonlyRecommended: cov.isCommonlyRecommended,
        },
      });
      console.log(`Updated existing: ${cov.name}`);
      continue;
    }

    await prisma.coverageDefinition.create({
      data: {
        code: cov.code,
        name: cov.name,
        kind: cov.kind,
        categoryId: cov.categoryId,
        policyTypeId: autoType.id,
        definition: cov.definition,
        riskSummary: cov.riskSummary,
        isCommonlyRecommended: cov.isCommonlyRecommended,
      },
    });
    console.log(`Created: ${cov.name}`);
    created++;
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
