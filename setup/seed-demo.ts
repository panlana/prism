import { createHash } from "node:crypto";

import { prisma } from "./seed-utils.js";
import { hashPassword } from "./password.js";

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function seedDemoData() {
  const principalRole = await prisma.role.findUniqueOrThrow({
    where: { key: "principal_agent" }
  });
  const producerRole = await prisma.role.findUniqueOrThrow({
    where: { key: "producer" }
  });
  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { key: "super_admin" }
  });
  const virginia = await prisma.state.findUniqueOrThrow({
    where: { code: "VA" }
  });
  const homeowners = await prisma.policyType.findUniqueOrThrow({
    where: { code: "HOMEOWNERS" }
  });
  const personalAuto = await prisma.policyType.findUniqueOrThrow({
    where: { code: "PERSONAL_AUTO" }
  });
  const nationwide = await prisma.carrier.findUniqueOrThrow({
    where: { slug: "nationwide" }
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "owner@prism.dev" },
    update: {
      firstName: "PRISM",
      lastName: "Owner",
      userType: "STAFF",
      passwordHash: hashPassword("dev-password"),
      ssoProvider: "google"
    },
    create: {
      email: "owner@prism.dev",
      firstName: "PRISM",
      lastName: "Owner",
      userType: "STAFF",
      passwordHash: hashPassword("dev-password"),
      ssoProvider: "google"
    }
  });

  await prisma.staffUserRole.upsert({
    where: {
      userId_roleId: {
        userId: staffUser.id,
        roleId: superAdminRole.id
      }
    },
    update: {},
    create: {
      userId: staffUser.id,
      roleId: superAdminRole.id
    }
  });

  const agency = await prisma.agency.upsert({
    where: { slug: "blue-ridge-insurance" },
    update: {
      name: "Blue Ridge Insurance",
      primaryEmail: "hello@blueridge.test",
      primaryPhone: "434-555-0100",
      planTier: "STANDARD_AI",
      hasInAppAi: true
    },
    create: {
      slug: "blue-ridge-insurance",
      name: "Blue Ridge Insurance",
      primaryEmail: "hello@blueridge.test",
      primaryPhone: "434-555-0100",
      planTier: "STANDARD_AI",
      hasInAppAi: true,
      settings: {
        agencyManagementSystem: "Applied Epic",
        emailProvider: "Resend",
        storage: "Supabase Storage"
      }
    }
  });

  const featureFlags = await prisma.featureFlag.findMany();

  for (const featureFlag of featureFlags) {
    await prisma.agencyFeatureFlag.upsert({
      where: {
        agencyId_featureFlagId: {
          agencyId: agency.id,
          featureFlagId: featureFlag.id
        }
      },
      update: {
        enabled: featureFlag.key !== "sms_hooks" ? true : false
      },
      create: {
        agencyId: agency.id,
        featureFlagId: featureFlag.id,
        enabled: featureFlag.key !== "sms_hooks" ? true : false
      }
    });
  }

  const agencyOwner = await prisma.user.upsert({
    where: { email: "jane@blueridge.test" },
    update: {
      firstName: "Jane",
      lastName: "Miller",
      userType: "AGENCY",
      passwordHash: hashPassword("dev-password"),
      ssoProvider: "microsoft"
    },
    create: {
      email: "jane@blueridge.test",
      firstName: "Jane",
      lastName: "Miller",
      userType: "AGENCY",
      passwordHash: hashPassword("dev-password"),
      ssoProvider: "microsoft"
    }
  });

  const producer = await prisma.user.upsert({
    where: { email: "alex@blueridge.test" },
    update: {
      firstName: "Alex",
      lastName: "Cole",
      userType: "AGENCY",
      passwordHash: hashPassword("dev-password")
    },
    create: {
      email: "alex@blueridge.test",
      firstName: "Alex",
      lastName: "Cole",
      userType: "AGENCY",
      passwordHash: hashPassword("dev-password")
    }
  });

  await prisma.agencyMembership.upsert({
    where: {
      agencyId_userId: {
        agencyId: agency.id,
        userId: agencyOwner.id
      }
    },
    update: {
      roleId: principalRole.id,
      status: "ACTIVE",
      isPrimary: true,
      joinedAt: new Date()
    },
    create: {
      agencyId: agency.id,
      userId: agencyOwner.id,
      roleId: principalRole.id,
      status: "ACTIVE",
      isPrimary: true,
      joinedAt: new Date()
    }
  });

  await prisma.agencyMembership.upsert({
    where: {
      agencyId_userId: {
        agencyId: agency.id,
        userId: producer.id
      }
    },
    update: {
      roleId: producerRole.id,
      status: "ACTIVE",
      joinedAt: new Date()
    },
    create: {
      agencyId: agency.id,
      userId: producer.id,
      roleId: producerRole.id,
      status: "ACTIVE",
      joinedAt: new Date()
    }
  });

  // Carrier appointments for all carriers the agency works with
  const appointmentCarrierSlugs = [
    "nationwide", "auto-owners", "cincinnati", "universal-property", "travelers", "augusta-mutual",
  ];
  for (const slug of appointmentCarrierSlugs) {
    const carrier = await prisma.carrier.findUnique({ where: { slug } });
    if (!carrier) {
      console.log(`  ! Carrier "${slug}" not found, skipping appointment.`);
      continue;
    }
    await prisma.agencyCarrierAppointment.upsert({
      where: {
        agencyId_carrierId_stateId: {
          agencyId: agency.id,
          carrierId: carrier.id,
          stateId: virginia.id,
        },
      },
      update: {},
      create: {
        agencyId: agency.id,
        carrierId: carrier.id,
        stateId: virginia.id,
      },
    });
  }

  for (const policyType of [homeowners, personalAuto]) {
    await prisma.agencyPolicyTypeSetting.upsert({
      where: {
        agencyId_policyTypeId: {
          agencyId: agency.id,
          policyTypeId: policyType.id
        }
      },
      update: {
        enabled: true,
        reviewConfig: {
          reviewTypes: ["thorough", "core", "recommendations_only"]
        }
      },
      create: {
        agencyId: agency.id,
        policyTypeId: policyType.id,
        reviewConfig: {
          reviewTypes: ["thorough", "core", "recommendations_only"]
        }
      }
    });
  }

  const waterBackup = await prisma.coverageDefinition.findFirstOrThrow({
    where: { name: "Water Backup" }
  });
  const roadside = await prisma.coverageDefinition.findFirstOrThrow({
    where: { name: "Roadside Assistance" }
  });

  await prisma.agencyRecommendation.createMany({
    data: [
      {
        agencyId: agency.id,
        policyTypeId: homeowners.id,
        coverageDefinitionId: waterBackup.id,
        type: "MISSING_COVERAGE",
        title: "Recommend Water Backup coverage",
        description: "Offer Water Backup when the carrier makes it available.",
        minimumLimitText: "$10,000"
      },
      {
        agencyId: agency.id,
        policyTypeId: personalAuto.id,
        coverageDefinitionId: roadside.id,
        type: "MISSING_COVERAGE",
        title: "Recommend Roadside Assistance",
        description: "Recommend adding roadside coverage for everyday breakdown support."
      }
    ],
    skipDuplicates: true
  });

  await prisma.agencyCrossSellRule.upsert({
    where: {
      agencyId_sourcePolicyTypeId_targetPolicyTypeId_label: {
        agencyId: agency.id,
        sourcePolicyTypeId: personalAuto.id,
        targetPolicyTypeId: homeowners.id,
        label: "Offer Homeowners review when only Auto is active"
      }
    },
    update: {
      priority: 10,
      isEnabled: true
    },
    create: {
      agencyId: agency.id,
      sourcePolicyTypeId: personalAuto.id,
      targetPolicyTypeId: homeowners.id,
      label: "Offer Homeowners review when only Auto is active",
      priority: 10
    }
  });

  await prisma.notificationEndpoint.createMany({
    data: [
      {
        agencyId: agency.id,
        kind: "SERVICE",
        label: "Service inbox",
        destination: "service@blueridge.test"
      },
      {
        agencyId: agency.id,
        kind: "CANCELLATION",
        label: "Cancellation inbox",
        destination: "cancel@blueridge.test"
      }
    ],
    skipDuplicates: true
  });

  await prisma.emailTemplate.upsert({
    where: {
      agencyId_name: {
        agencyId: agency.id,
        name: "Renewal review invitation"
      }
    },
    update: {
      templateType: "renewal_invite",
      subject: "Your annual policy review is ready",
      bodyText:
        "Use your secure link to review your policies and request coverage updates."
    },
    create: {
      agencyId: agency.id,
      name: "Renewal review invitation",
      templateType: "renewal_invite",
      subject: "Your annual policy review is ready",
      bodyText:
        "Use your secure link to review your policies and request coverage updates."
    }
  });

  const insuredUser = await prisma.user.upsert({
    where: { email: "taylor@customer.test" },
    update: {
      firstName: "Taylor",
      lastName: "Brooks",
      userType: "INSURED"
    },
    create: {
      email: "taylor@customer.test",
      firstName: "Taylor",
      lastName: "Brooks",
      userType: "INSURED"
    }
  });

  const insuredAccount = await prisma.insuredAccount.upsert({
    where: {
      agencyId_accountCode: {
        agencyId: agency.id,
        accountCode: "BRI-0001"
      }
    },
    update: {
      displayName: "Taylor Brooks Household",
      primaryEmail: "taylor@customer.test",
      primaryPhone: "434-555-0155",
      primaryStateId: virginia.id,
      city: "Roanoke",
      postalCode: "24011"
    },
    create: {
      agencyId: agency.id,
      accountCode: "BRI-0001",
      displayName: "Taylor Brooks Household",
      primaryEmail: "taylor@customer.test",
      primaryPhone: "434-555-0155",
      primaryStateId: virginia.id,
      streetLineOne: "101 Maple Street",
      city: "Roanoke",
      postalCode: "24011",
      sourceSystem: "spreadsheet"
    }
  });

  const existingContact = await prisma.insuredContact.findFirst({
    where: {
      insuredAccountId: insuredAccount.id,
      email: "taylor@customer.test"
    }
  });

  if (existingContact) {
    await prisma.insuredContact.update({
      where: {
        id: existingContact.id
      },
      data: {
        userId: insuredUser.id,
        firstName: "Taylor",
        lastName: "Brooks",
        phone: "434-555-0155",
        isPrimary: true,
        relationship: "Primary"
      }
    });
  } else {
    await prisma.insuredContact.create({
      data: {
        insuredAccountId: insuredAccount.id,
        userId: insuredUser.id,
        firstName: "Taylor",
        lastName: "Brooks",
        email: "taylor@customer.test",
        phone: "434-555-0155",
        isPrimary: true,
        relationship: "Primary"
      }
    });
  }

  const homePolicy = await prisma.policy.upsert({
    where: {
      agencyId_policyNumber: {
        agencyId: agency.id,
        policyNumber: "NWHO-10001"
      }
    },
    update: {
      insuredAccountId: insuredAccount.id,
      policyTypeId: homeowners.id,
      carrierId: nationwide.id,
      stateId: virginia.id,
      status: "ACTIVE",
      effectiveDate: new Date("2026-01-01"),
      expirationDate: new Date("2027-01-01"),
      premium: "1842.00",
      readinessSource: "DECLARATION_PAGE",
      readinessConfirmedAt: new Date(),
      producerName: "Alex Cole",
      locationName: "Roanoke"
    },
    create: {
      agencyId: agency.id,
      insuredAccountId: insuredAccount.id,
      policyTypeId: homeowners.id,
      carrierId: nationwide.id,
      stateId: virginia.id,
      policyNumber: "NWHO-10001",
      status: "ACTIVE",
      effectiveDate: new Date("2026-01-01"),
      expirationDate: new Date("2027-01-01"),
      premium: "1842.00",
      readinessSource: "DECLARATION_PAGE",
      readinessConfirmedAt: new Date(),
      producerName: "Alex Cole",
      locationName: "Roanoke"
    }
  });

  const autoPolicy = await prisma.policy.upsert({
    where: {
      agencyId_policyNumber: {
        agencyId: agency.id,
        policyNumber: "NWPA-20001"
      }
    },
    update: {
      insuredAccountId: insuredAccount.id,
      policyTypeId: personalAuto.id,
      carrierId: nationwide.id,
      stateId: virginia.id,
      status: "ACTIVE",
      effectiveDate: new Date("2026-02-01"),
      expirationDate: new Date("2027-02-01"),
      premium: "1124.00",
      readinessSource: "DECLARATION_PAGE",
      readinessConfirmedAt: new Date(),
      producerName: "Alex Cole",
      locationName: "Roanoke"
    },
    create: {
      agencyId: agency.id,
      insuredAccountId: insuredAccount.id,
      policyTypeId: personalAuto.id,
      carrierId: nationwide.id,
      stateId: virginia.id,
      policyNumber: "NWPA-20001",
      status: "ACTIVE",
      effectiveDate: new Date("2026-02-01"),
      expirationDate: new Date("2027-02-01"),
      premium: "1124.00",
      readinessSource: "DECLARATION_PAGE",
      readinessConfirmedAt: new Date(),
      producerName: "Alex Cole",
      locationName: "Roanoke"
    }
  });

  const homeDoc = await prisma.document.upsert({
    where: {
      bucket_storagePath: {
        bucket: "documents",
        storagePath: "declarations/blue-ridge-insurance/home/NWHO-10001.pdf"
      }
    },
    update: {
      agencyId: agency.id,
      kind: "DECLARATION_PAGE",
      fileName: "NWHO-10001.pdf",
      mimeType: "application/pdf",
      uploadedByUserId: agencyOwner.id
    },
    create: {
      agencyId: agency.id,
      kind: "DECLARATION_PAGE",
      bucket: "documents",
      storagePath: "declarations/blue-ridge-insurance/home/NWHO-10001.pdf",
      fileName: "NWHO-10001.pdf",
      mimeType: "application/pdf",
      uploadedByUserId: agencyOwner.id
    }
  });

  const autoDoc = await prisma.document.upsert({
    where: {
      bucket_storagePath: {
        bucket: "documents",
        storagePath: "declarations/blue-ridge-insurance/auto/NWPA-20001.pdf"
      }
    },
    update: {
      agencyId: agency.id,
      kind: "DECLARATION_PAGE",
      fileName: "NWPA-20001.pdf",
      mimeType: "application/pdf",
      uploadedByUserId: agencyOwner.id
    },
    create: {
      agencyId: agency.id,
      kind: "DECLARATION_PAGE",
      bucket: "documents",
      storagePath: "declarations/blue-ridge-insurance/auto/NWPA-20001.pdf",
      fileName: "NWPA-20001.pdf",
      mimeType: "application/pdf",
      uploadedByUserId: agencyOwner.id
    }
  });

  await prisma.policyDeclarationPage.upsert({
    where: {
      policyId_documentId: {
        policyId: homePolicy.id,
        documentId: homeDoc.id,
      }
    },
    update: {
      extractionStatus: "CONFIRMED",
      isActive: true,
      confidence: "0.9300",
      humanConfirmedAt: new Date(),
      extractedSummary: {
        carrier: "Nationwide",
        forms: ["NW-HO-VA-BASE", "NW-HO-WB-VA"]
      }
    },
    create: {
      policyId: homePolicy.id,
      documentId: homeDoc.id,
      extractionStatus: "CONFIRMED",
      isActive: true,
      confidence: "0.9300",
      humanConfirmedAt: new Date(),
      extractedSummary: {
        carrier: "Nationwide",
        forms: ["NW-HO-VA-BASE", "NW-HO-WB-VA"]
      }
    }
  });

  await prisma.policyDeclarationPage.upsert({
    where: {
      policyId_documentId: {
        policyId: autoPolicy.id,
        documentId: autoDoc.id,
      }
    },
    update: {
      extractionStatus: "CONFIRMED",
      isActive: true,
      confidence: "0.9100",
      humanConfirmedAt: new Date(),
      extractedSummary: {
        carrier: "Nationwide",
        forms: ["NW-PA-VA-BASE", "NW-PA-RSA-VA"]
      }
    },
    create: {
      policyId: autoPolicy.id,
      documentId: autoDoc.id,
      extractionStatus: "CONFIRMED",
      isActive: true,
      confidence: "0.9100",
      humanConfirmedAt: new Date(),
      extractedSummary: {
        carrier: "Nationwide",
        forms: ["NW-PA-VA-BASE", "NW-PA-RSA-VA"]
      }
    }
  });

  const homeForms = await prisma.offeringForm.findMany({
    where: {
      offering: {
        carrier: { slug: "nationwide" },
        state: { code: "VA" },
        policyType: { code: "HOMEOWNERS" }
      }
    }
  });

  const autoForms = await prisma.offeringForm.findMany({
    where: {
      offering: {
        carrier: { slug: "nationwide" },
        state: { code: "VA" },
        policyType: { code: "PERSONAL_AUTO" }
      }
    }
  });

  for (const form of [...homeForms, ...autoForms]) {
    const policyId = form.title.includes("Homeowners") || form.title.includes("Water Backup") ? homePolicy.id : autoPolicy.id;

    await prisma.policyFormSelection.upsert({
      where: {
        policyId_offeringFormId: {
          policyId,
          offeringFormId: form.id
        }
      },
      update: {
        source: "DECLARATION_PAGE"
      },
      create: {
        policyId,
        offeringFormId: form.id,
        source: "DECLARATION_PAGE"
      }
    });
  }

  const existingReviewSession = await prisma.reviewSession.findFirst({
    where: {
      agencyId: agency.id,
      policyId: homePolicy.id,
      summary: "Taylor requested a quote for Water Backup coverage."
    }
  });

  const reviewSession = existingReviewSession
    ? await prisma.reviewSession.update({
        where: {
          id: existingReviewSession.id
        },
        data: {
          insuredAccountId: insuredAccount.id,
          initiatedByUserId: insuredUser.id,
          channel: "INSURED_PORTAL",
          status: "AWAITING_AGENCY",
          actionItems: [
            {
              type: "quote_request",
              title: "Provide Water Backup quote option"
            }
          ],
          startedAt: new Date("2026-03-05T15:00:00Z"),
          completedAt: new Date("2026-03-05T15:18:00Z")
        }
      })
    : await prisma.reviewSession.create({
        data: {
          agencyId: agency.id,
          insuredAccountId: insuredAccount.id,
          policyId: homePolicy.id,
          initiatedByUserId: insuredUser.id,
          channel: "INSURED_PORTAL",
          status: "AWAITING_AGENCY",
          summary: "Taylor requested a quote for Water Backup coverage.",
          actionItems: [
            {
              type: "quote_request",
              title: "Provide Water Backup quote option"
            }
          ],
          startedAt: new Date("2026-03-05T15:00:00Z"),
          completedAt: new Date("2026-03-05T15:18:00Z")
        }
      });

  const existingTask = await prisma.reviewTask.findFirst({
    where: {
      reviewSessionId: reviewSession.id,
      title: "Send Water Backup quote follow-up"
    }
  });

  if (existingTask) {
    await prisma.reviewTask.update({
      where: {
        id: existingTask.id
      },
      data: {
        agencyId: agency.id,
        insuredAccountId: insuredAccount.id,
        policyId: homePolicy.id,
        assignedToUserId: producer.id,
        type: "QUOTE_REQUEST",
        status: "OPEN",
        description: "Customer requested pricing after the AI policy review session.",
        dueAt: new Date("2026-03-08T21:00:00Z")
      }
    });
  } else {
    await prisma.reviewTask.create({
      data: {
        agencyId: agency.id,
        insuredAccountId: insuredAccount.id,
        policyId: homePolicy.id,
        reviewSessionId: reviewSession.id,
        assignedToUserId: producer.id,
        type: "QUOTE_REQUEST",
        status: "OPEN",
        title: "Send Water Backup quote follow-up",
        description: "Customer requested pricing after the AI policy review session.",
        dueAt: new Date("2026-03-08T21:00:00Z")
      }
    });
  }

  const existingNote = await prisma.activityNote.findFirst({
    where: {
      reviewSessionId: reviewSession.id,
      title: "Policy review completed"
    }
  });

  if (existingNote) {
    await prisma.activityNote.update({
      where: {
        id: existingNote.id
      },
      data: {
        agencyId: agency.id,
        insuredAccountId: insuredAccount.id,
        policyId: homePolicy.id,
        createdByUserId: insuredUser.id,
        source: "AI_REVIEW",
        body: "AI completed the homeowners review and logged a Water Backup quote request."
      }
    });
  } else {
    await prisma.activityNote.create({
      data: {
        agencyId: agency.id,
        insuredAccountId: insuredAccount.id,
        policyId: homePolicy.id,
        reviewSessionId: reviewSession.id,
        createdByUserId: insuredUser.id,
        source: "AI_REVIEW",
        title: "Policy review completed",
        body: "AI completed the homeowners review and logged a Water Backup quote request."
      }
    });
  }

  await prisma.magicLoginToken.upsert({
    where: {
      tokenHash: hashToken("demo-magic-link")
    },
    update: {
      email: insuredUser.email,
      expiresAt: new Date("2026-12-31T23:59:59Z")
    },
    create: {
      userId: insuredUser.id,
      email: insuredUser.email,
      tokenHash: hashToken("demo-magic-link"),
      expiresAt: new Date("2026-12-31T23:59:59Z")
    }
  });
}
