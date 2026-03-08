import { prisma } from "./seed-utils.js";

const states = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
  ["DC", "District of Columbia"]
] as const;

const featureFlags = [
  {
    key: "policy_reviews",
    name: "Policy Reviews",
    description: "Enables the insured policy review workflow.",
    defaultEnabled: true
  },
  {
    key: "insured_portal",
    name: "Insured Portal",
    description: "Enables the insured self-service portal.",
    defaultEnabled: true
  },
  {
    key: "ams_integration",
    name: "Agency Management System Integration",
    description: "Enables AMS sync and activity push.",
    defaultEnabled: false
  },
  {
    key: "document_ocr",
    name: "Document OCR",
    description: "Enables OCR and AI-assisted dec page extraction.",
    defaultEnabled: true
  },
  {
    key: "sms_hooks",
    name: "SMS Hooks",
    description: "Reserves SMS-based resets and notifications.",
    defaultEnabled: false
  },
  {
    key: "in_app_ai",
    name: "In-App AI",
    description: "Enables agency-side AI orchestration features.",
    defaultEnabled: false
  }
];

const permissions = [
  // Staff permissions
  ["staff.dashboard.view", "View dashboard", "STAFF"],
  ["staff.agencies.view", "View agencies", "STAFF"],
  ["staff.agencies.manage", "Manage agencies", "STAFF"],
  ["staff.coverage.view", "View coverage library", "STAFF"],
  ["staff.coverage.manage", "Manage coverage library", "STAFF"],
  ["staff.carriers.view", "View carriers", "STAFF"],
  ["staff.carriers.manage", "Manage carriers", "STAFF"],
  ["staff.ai.view", "View AI configuration", "STAFF"],
  ["staff.ai.manage", "Manage AI configuration", "STAFF"],
  ["staff.ai_usage.view", "View AI usage reporting", "STAFF"],
  ["staff.flags.view", "View feature flags", "STAFF"],
  ["staff.flags.manage", "Manage feature flags", "STAFF"],
  ["staff.rbac.view", "View roles and permissions", "STAFF"],
  ["staff.rbac.manage", "Manage roles and permissions", "STAFF"],
  ["staff.users.view", "View staff users", "STAFF"],
  ["staff.users.manage", "Manage staff users", "STAFF"],
  ["staff.impersonate", "Impersonate agency users", "STAFF"],
  // Agency permissions
  ["agency.users.manage", "Manage agency users", "AGENCY"],
  ["insureds.manage", "Manage insureds and contacts", "AGENCY"],
  ["policies.manage", "Manage policy records", "AGENCY"],
  ["policy_reviews.manage", "Manage policy reviews", "AGENCY"],
  ["reports.view", "View reports", "AGENCY"],
  ["settings.manage", "Manage agency settings", "AGENCY"],
] as const;

const allStaffPermissions = permissions
  .filter(([, , scope]) => scope === "STAFF")
  .map(([key]) => key);

const staffViewPermissions = allStaffPermissions.filter((k) => k.endsWith(".view"));

const roles = [
  {
    key: "super_admin",
    name: "Super Admin",
    scope: "STAFF",
    permissionKeys: allStaffPermissions,
  },
  {
    key: "admin",
    name: "Admin",
    scope: "STAFF",
    permissionKeys: allStaffPermissions.filter((k) => k !== "staff.impersonate"),
  },
  {
    key: "manager",
    name: "Manager",
    scope: "STAFF",
    permissionKeys: [...staffViewPermissions, "staff.agencies.manage", "staff.impersonate"],
  },
  {
    key: "support_agent",
    name: "Support Agent",
    scope: "STAFF",
    permissionKeys: ["staff.dashboard.view", "staff.agencies.view", "staff.impersonate"],
  },
  {
    key: "principal_agent",
    name: "Principal Agent",
    scope: "AGENCY",
    permissionKeys: ["agency.users.manage", "insureds.manage", "policies.manage", "policy_reviews.manage", "reports.view", "settings.manage"],
  },
  {
    key: "producer",
    name: "Producer",
    scope: "AGENCY",
    permissionKeys: ["insureds.manage", "policies.manage", "policy_reviews.manage", "reports.view"],
  },
] as const;

const policyTypes = [
  { code: "HOMEOWNERS", name: "Homeowners", lineOfBusiness: "Personal Lines" },
  { code: "PERSONAL_AUTO", name: "Personal Auto", lineOfBusiness: "Personal Lines" }
];

const coverageSeeds = {
  HOMEOWNERS: [
    {
      name: "Dwelling",
      aliasOne: "Coverage A",
      definition: "Protects the home structure against covered causes of loss.",
      claimExamples: "Fire damage, wind damage, or major rebuild situations.",
      additionalHelp: "The agency may recommend higher limits when replacement costs rise."
    },
    {
      name: "Water Backup",
      aliasOne: "Water Backup and Sump Overflow",
      definition: "Protects against certain losses caused by sewer or drain backup.",
      claimExamples: "Water backing up through drains after a storm.",
      additionalHelp: "A common agency recommendation when the carrier offers it."
    }
  ],
  PERSONAL_AUTO: [
    {
      name: "Liability",
      aliasOne: "Bodily Injury and Property Damage Liability",
      definition: "Protects the insured when they are legally responsible for injuries or damage.",
      claimExamples: "At-fault accidents that injure others or damage property.",
      additionalHelp: "The agency can set a minimum recommended limit by policy type."
    },
    {
      name: "Roadside Assistance",
      aliasOne: "Towing and Labor",
      definition: "Provides assistance for towing or roadside disablement events.",
      claimExamples: "Towing after a breakdown or dead battery service.",
      additionalHelp: "Often recommended when the carrier offers the endorsement."
    }
  ]
} as const;

const starterOfferings = [
  {
    carrierSlug: "nationwide",
    stateCode: "VA",
    policyTypeCode: "HOMEOWNERS",
    forms: [
      {
        title: "Virginia Homeowners Policy",
        formNumber: "NW-HO-VA-BASE",
        version: "01-2026",
        kind: "BASE_POLICY",
        isBasePolicy: true,
        coverageNames: ["Dwelling"]
      },
      {
        title: "Water Backup Endorsement",
        formNumber: "NW-HO-WB-VA",
        version: "01-2026",
        kind: "ENDORSEMENT",
        isBasePolicy: false,
        coverageNames: ["Water Backup"]
      }
    ]
  },
  {
    carrierSlug: "nationwide",
    stateCode: "VA",
    policyTypeCode: "PERSONAL_AUTO",
    forms: [
      {
        title: "Virginia Personal Auto Policy",
        formNumber: "NW-PA-VA-BASE",
        version: "01-2026",
        kind: "BASE_POLICY",
        isBasePolicy: true,
        coverageNames: ["Liability"]
      },
      {
        title: "Roadside Assistance Endorsement",
        formNumber: "NW-PA-RSA-VA",
        version: "01-2026",
        kind: "ENDORSEMENT",
        isBasePolicy: false,
        coverageNames: ["Roadside Assistance"]
      }
    ]
  }
] as const;

export async function seedReferenceData() {
  for (const [code, name] of states) {
    await prisma.state.upsert({
      where: { code },
      update: { name, isActive: true },
      create: { code, name }
    });
  }

  for (const featureFlag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: featureFlag.key },
      update: featureFlag,
      create: featureFlag
    });
  }

  for (const [key, name, scope] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { name, scope, description: name },
      create: { key, name, scope, description: name }
    });
  }

  for (const role of roles) {
    const savedRole = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, scope: role.scope, isSystem: true },
      create: { key: role.key, name: role.name, scope: role.scope, isSystem: true }
    });

    // Resolve permission IDs for this role
    const permissionIds: string[] = [];
    for (const permissionKey of role.permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey }
      });
      permissionIds.push(permission.id);
    }

    // Replace all role→permission mappings (removes stale ones)
    await prisma.rolePermission.deleteMany({ where: { roleId: savedRole.id } });
    for (const permissionId of permissionIds) {
      await prisma.rolePermission.create({
        data: { roleId: savedRole.id, permissionId }
      });
    }
  }

  for (const policyType of policyTypes) {
    await prisma.policyType.upsert({
      where: { code: policyType.code },
      update: policyType,
      create: policyType
    });
  }

  await prisma.carrier.upsert({
    where: { slug: "nationwide" },
    update: { name: "Nationwide", isActive: true },
    create: {
      slug: "nationwide",
      name: "Nationwide"
    }
  });

  for (const [policyTypeCode, coverages] of Object.entries(coverageSeeds)) {
    const policyType = await prisma.policyType.findUniqueOrThrow({
      where: { code: policyTypeCode }
    });

    for (const coverage of coverages) {
      await prisma.coverageDefinition.upsert({
        where: {
          id: `${policyType.id}:${coverage.name}`
        },
        update: {
          policyTypeId: policyType.id,
          aliasOne: coverage.aliasOne,
          definition: coverage.definition,
          claimExamples: coverage.claimExamples,
          additionalHelp: coverage.additionalHelp
        },
        create: {
          id: `${policyType.id}:${coverage.name}`,
          policyTypeId: policyType.id,
          name: coverage.name,
          aliasOne: coverage.aliasOne,
          definition: coverage.definition,
          claimExamples: coverage.claimExamples,
          additionalHelp: coverage.additionalHelp
        }
      });
    }
  }

  for (const offeringSeed of starterOfferings) {
    const carrier = await prisma.carrier.findUniqueOrThrow({
      where: { slug: offeringSeed.carrierSlug }
    });
    const state = await prisma.state.findUniqueOrThrow({
      where: { code: offeringSeed.stateCode }
    });
    const policyType = await prisma.policyType.findUniqueOrThrow({
      where: { code: offeringSeed.policyTypeCode }
    });

    const offering = await prisma.carrierPolicyOffering.upsert({
      where: {
        carrierId_stateId_policyTypeId: {
          carrierId: carrier.id,
          stateId: state.id,
          policyTypeId: policyType.id
        }
      },
      update: {},
      create: {
        carrierId: carrier.id,
        stateId: state.id,
        policyTypeId: policyType.id
      }
    });

    let sortOrder = 10;

    for (const formSeed of offeringSeed.forms) {
      const form = await prisma.offeringForm.upsert({
        where: {
          offeringId_title: {
            offeringId: offering.id,
            title: formSeed.title
          }
        },
        update: {
          formNumber: formSeed.formNumber,
          version: formSeed.version,
          kind: formSeed.kind,
          isBasePolicy: formSeed.isBasePolicy,
          storagePath: `carrier-library/${carrier.slug}/${state.code}/${policyType.code}/${formSeed.formNumber}.pdf`
        },
        create: {
          offeringId: offering.id,
          title: formSeed.title,
          formNumber: formSeed.formNumber,
          version: formSeed.version,
          kind: formSeed.kind,
          isBasePolicy: formSeed.isBasePolicy,
          storagePath: `carrier-library/${carrier.slug}/${state.code}/${policyType.code}/${formSeed.formNumber}.pdf`
        }
      });

      for (const coverageName of formSeed.coverageNames) {
        const coverage = await prisma.coverageDefinition.findFirstOrThrow({
          where: {
            policyTypeId: policyType.id,
            name: coverageName
          }
        });

        await prisma.formCoverageMapping.upsert({
          where: {
            offeringFormId_coverageDefinitionId: {
              offeringFormId: form.id,
              coverageDefinitionId: coverage.id
            }
          },
          update: {},
          create: {
            offeringFormId: form.id,
            coverageDefinitionId: coverage.id
          }
        });

        const existingOrderItem = await prisma.reviewOrderItem.findFirst({
          where: {
            offeringId: offering.id,
            itemType: "COVERAGE",
            label: coverage.name
          }
        });

        if (existingOrderItem) {
          await prisma.reviewOrderItem.update({
            where: {
              id: existingOrderItem.id
            },
            data: {
              sortOrder,
              coverageDefinitionId: coverage.id,
              policyTypeId: policyType.id
            }
          });
        } else {
          await prisma.reviewOrderItem.create({
            data: {
              policyTypeId: policyType.id,
              offeringId: offering.id,
              coverageDefinitionId: coverage.id,
              itemType: "COVERAGE",
              label: coverage.name,
              sortOrder
            }
          });
        }

        sortOrder += 10;
      }
    }
  }
}
