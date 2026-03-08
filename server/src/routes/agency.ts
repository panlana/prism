import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/db.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import { requireAgencyUser, requirePermission } from "../middleware/auth.js";
import { assembleContext } from "../ai/context/assembler.js";
import {
  chatCompletion,
  type ChatCompletionUsageContext,
  type ChatMessage,
} from "../ai/gateway.js";
import { extractDeclarationPage } from "../ai/extraction.js";
import { metaTools, executeTool, executeSearch, getToolSchema, getToolCatalog, type ToolResult, type ToolContext } from "../ai/tools.js";
import {
  createInsured,
  updateInsured,
  addContact,
  updateContact,
  deleteInsured,
  deleteContact,
} from "../services/insureds.js";
import {
  createPolicy,
  updatePolicy,
  deletePolicy,
} from "../services/policies.js";

const insuredSearchSchema = z.object({
  query: z.string().trim().optional(),
});

const policySearchSchema = z.object({
  insuredAccountId: z.string().min(1).optional(),
});

const contactInputSchema = z.object({
  id: z.string().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().min(1).optional().or(z.literal("")),
  relationship: z.string().trim().min(1).optional(),
  isPrimary: z.boolean().default(false)
});

const insuredMutationSchema = z.object({
  accountCode: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  primaryStateCode: z.string().trim().length(2).optional(),
  primaryEmail: z.string().trim().email().optional().or(z.literal("")),
  primaryPhone: z.string().trim().min(1).optional().or(z.literal("")),
  streetLineOne: z.string().trim().min(1).optional(),
  streetLineTwo: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  postalCode: z.string().trim().min(1).optional(),
  sourceSystem: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  contacts: z.array(contactInputSchema).max(10).default([])
});

const policyMutationSchema = z.object({
  insuredAccountId: z.string().min(1),
  policyTypeCode: z.string().trim().min(1),
  stateCode: z.string().trim().length(2).optional(),
  carrierSlug: z.string().trim().min(1).optional(),
  policyNumber: z.string().trim().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "CANCELLED", "EXPIRED"]).default("DRAFT"),
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  premium: z.union([z.string().trim().min(1), z.number()]).optional(),
  readinessSource: z.enum(["NONE", "DECLARATION_PAGE", "AMS", "MANUAL"]).default("NONE"),
  extractedCarrierName: z.string().trim().min(1).optional(),
  producerName: z.string().trim().min(1).optional(),
  locationName: z.string().trim().min(1).optional()
});

const taskStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "CLOSED"]),
  description: z.string().trim().min(1).optional(),
  dueAt: z.string().datetime().nullable().optional()
});

const reviewStatusSchema = z.object({
  status: z.enum(["INVITED", "STARTED", "IN_PROGRESS", "AWAITING_AGENCY", "CLOSED"]),
  summary: z.string().trim().min(1).optional(),
  closeOpenTasks: z.boolean().default(false)
});

const noteCreateSchema = z.object({
  insuredAccountId: z.string().min(1),
  policyId: z.string().min(1).optional(),
  reviewSessionId: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1)
});

export const agencyRouter = Router();

async function requireAgencyOwnedInsured(agencyId: string, insuredAccountId: string) {
  const insured = await prisma.insuredAccount.findFirst({
    where: {
      id: insuredAccountId,
      agencyId
    }
  });

  if (!insured) {
    throw new HttpError(404, "Insured account not found for the active agency.");
  }

  return insured;
}

function getRouteParam(value: string | string[] | undefined, label: string) {
  if (!value || Array.isArray(value)) {
    throw new HttpError(400, `Invalid route parameter: ${label}`);
  }

  return value;
}

async function requireAgencyOwnedPolicy(agencyId: string, policyId: string) {
  const policy = await prisma.policy.findFirst({
    where: {
      id: policyId,
      agencyId
    }
  });

  if (!policy) {
    throw new HttpError(404, "Policy not found for the active agency.");
  }

  return policy;
}

async function requireAgencyOwnedTask(agencyId: string, taskId: string) {
  const task = await prisma.reviewTask.findFirst({
    where: {
      id: taskId,
      agencyId
    }
  });

  if (!task) {
    throw new HttpError(404, "Task not found for the active agency.");
  }

  return task;
}

async function requireAgencyOwnedReview(agencyId: string, reviewSessionId: string) {
  const review = await prisma.reviewSession.findFirst({
    where: {
      id: reviewSessionId,
      agencyId
    }
  });

  if (!review) {
    throw new HttpError(404, "Review session not found for the active agency.");
  }

  return review;
}

agencyRouter.get(
  "/dashboard",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);

    const [insuredCount, activePolicyCount, openTaskCount, pendingReviewCount, totalPremiumResult, recentTasks, recentReviews] =
      await Promise.all([
        prisma.insuredAccount.count({
          where: {
            agencyId: auth.activeAgencyId
          }
        }),
        prisma.policy.count({
          where: {
            agencyId: auth.activeAgencyId,
            status: "ACTIVE"
          }
        }),
        prisma.reviewTask.count({
          where: {
            agencyId: auth.activeAgencyId,
            status: {
              in: ["OPEN", "IN_PROGRESS", "BLOCKED"]
            }
          }
        }),
        prisma.reviewSession.count({
          where: {
            agencyId: auth.activeAgencyId,
            status: {
              in: ["INVITED", "STARTED", "IN_PROGRESS"]
            }
          }
        }),
        prisma.policy.aggregate({
          where: {
            agencyId: auth.activeAgencyId,
            status: "ACTIVE"
          },
          _sum: {
            premium: true
          }
        }),
        prisma.reviewTask.findMany({
          where: {
            agencyId: auth.activeAgencyId,
            status: {
              in: ["OPEN", "IN_PROGRESS", "BLOCKED"]
            }
          },
          include: {
            insuredAccount: true,
            policy: {
              include: {
                policyType: true
              }
            },
            assignedTo: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 5
        }),
        prisma.reviewSession.findMany({
          where: {
            agencyId: auth.activeAgencyId
          },
          include: {
            insuredAccount: true,
            policy: {
              include: {
                policyType: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 5
        })
      ]);

    response.json({
      summary: {
        insuredCount,
        activePolicyCount,
        openTaskCount,
        pendingReviewCount,
        totalPremium: totalPremiumResult._sum.premium ?? 0
      },
      recentTasks: recentTasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueAt: task.dueAt,
        insuredDisplayName: task.insuredAccount.displayName,
        policyTypeName: task.policy?.policyType.name,
        assignedTo: task.assignedTo
          ? [task.assignedTo.firstName, task.assignedTo.lastName].filter(Boolean).join(" ") ||
            task.assignedTo.email
          : null
      })),
      recentReviews: recentReviews.map((review) => ({
        id: review.id,
        status: review.status,
        createdAt: review.createdAt,
        completedAt: review.completedAt,
        insuredDisplayName: review.insuredAccount.displayName,
        policyTypeName: review.policy?.policyType.name ?? null,
        summary: review.summary
      }))
    });
  })
);

agencyRouter.get(
  "/reference-data",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);

    const [states, carriers, policyTypes, agencyUsers] = await Promise.all([
      prisma.state.findMany({
        orderBy: {
          code: "asc"
        }
      }),
      prisma.carrier.findMany({
        orderBy: {
          name: "asc"
        }
      }),
      prisma.policyType.findMany({
        orderBy: {
          name: "asc"
        }
      }),
      prisma.agencyMembership.findMany({
        where: {
          agencyId: auth.activeAgencyId,
          status: "ACTIVE"
        },
        include: {
          user: true,
          role: true
        },
        orderBy: {
          user: {
            firstName: "asc"
          }
        }
      })
    ]);

    response.json({
      states: states.map((state) => ({
        id: state.id,
        code: state.code,
        name: state.name
      })),
      carriers: carriers.map((carrier) => ({
        id: carrier.id,
        slug: carrier.slug,
        name: carrier.name
      })),
      policyTypes: policyTypes.map((policyType) => ({
        id: policyType.id,
        code: policyType.code,
        name: policyType.name
      })),
      agencyUsers: agencyUsers.map((membership) => ({
        userId: membership.userId,
        email: membership.user.email,
        roleKey: membership.role.key,
        displayName:
          [membership.user.firstName, membership.user.lastName].filter(Boolean).join(" ") ||
          membership.user.email
      }))
    });
  })
);

agencyRouter.get(
  "/insureds",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "insureds.manage");

    const input = insuredSearchSchema.parse(request.query);
    const query = input.query?.toLowerCase();

    const insureds = await prisma.insuredAccount.findMany({
      where: {
        agencyId: auth.activeAgencyId,
        ...(query
          ? {
              OR: [
                { accountCode: { contains: query, mode: "insensitive" } },
                { displayName: { contains: query, mode: "insensitive" } },
                { primaryEmail: { contains: query, mode: "insensitive" } },
                { primaryPhone: { contains: query, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        contacts: {
          orderBy: {
            isPrimary: "desc"
          }
        },
        policies: {
          include: {
            carrier: true,
            policyType: true
          },
          orderBy: {
            expirationDate: "asc"
          }
        }
      },
      orderBy: {
        displayName: "asc"
      },
    });

    response.json({
      items: insureds.map((insured) => ({
        id: insured.id,
        accountCode: insured.accountCode,
        displayName: insured.displayName,
        primaryEmail: insured.primaryEmail,
        primaryPhone: insured.primaryPhone,
        contacts: insured.contacts.map((contact) => ({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          isPrimary: contact.isPrimary
        })),
        policies: insured.policies.map((policy) => ({
          id: policy.id,
          policyNumber: policy.policyNumber,
          status: policy.status,
          premium: policy.premium,
          effectiveDate: policy.effectiveDate,
          expirationDate: policy.expirationDate,
          readinessSource: policy.readinessSource,
          carrierName: policy.carrier?.name ?? policy.extractedCarrierName,
          policyTypeName: policy.policyType.name
        }))
      }))
    });
  })
);

agencyRouter.get(
  "/insureds/:insuredAccountId",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "insureds.manage");

    const insuredAccountId = getRouteParam(request.params.insuredAccountId, "insuredAccountId");
    const insured = await prisma.insuredAccount.findFirst({
      where: {
        id: insuredAccountId,
        agencyId: auth.activeAgencyId
      },
      include: {
        primaryState: true,
        contacts: {
          orderBy: {
            isPrimary: "desc"
          }
        },
        policies: {
          include: {
            carrier: true,
            policyType: true,
            declarationPages: {
              where: {
                isActive: true
              }
            },
            reviewSessions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 3
            }
          },
          orderBy: {
            expirationDate: "asc"
          }
        },
        tasks: {
          where: {
            status: {
              in: ["OPEN", "IN_PROGRESS", "BLOCKED"]
            }
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 10
        },
        notesList: {
          orderBy: {
            createdAt: "desc"
          },
          take: 10
        },
        reviewSessions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 10
        }
      }
    });

    if (!insured) {
      throw new HttpError(404, "Insured account not found for the active agency.");
    }

    response.json({
      insured: {
        id: insured.id,
        accountCode: insured.accountCode,
        displayName: insured.displayName,
        primaryEmail: insured.primaryEmail,
        primaryPhone: insured.primaryPhone,
        primaryState: insured.primaryState
          ? {
              code: insured.primaryState.code,
              name: insured.primaryState.name
            }
          : null,
        address: {
          streetLineOne: insured.streetLineOne,
          streetLineTwo: insured.streetLineTwo,
          city: insured.city,
          postalCode: insured.postalCode
        },
        contacts: insured.contacts,
        policies: insured.policies.map((policy) => ({
          id: policy.id,
          policyNumber: policy.policyNumber,
          status: policy.status,
          premium: policy.premium,
          effectiveDate: policy.effectiveDate,
          expirationDate: policy.expirationDate,
          readinessSource: policy.readinessSource,
          isReviewReady:
            policy.declarationPages.length > 0 || policy.readinessSource === "AMS",
          carrierName: policy.carrier?.name ?? policy.extractedCarrierName,
          policyTypeName: policy.policyType.name,
          recentReviews: policy.reviewSessions.map((review) => ({
            id: review.id,
            status: review.status,
            summary: review.summary,
            createdAt: review.createdAt
          }))
        })),
        tasks: insured.tasks,
        notes: insured.notesList,
        reviewSessions: insured.reviewSessions
      }
    });
  })
);

agencyRouter.post(
  "/insureds",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "insureds.manage");

    const input = insuredMutationSchema.parse(request.body);

    const result = await createInsured(auth.activeAgencyId, {
      accountCode: input.accountCode,
      displayName: input.displayName,
      primaryEmail: input.primaryEmail || undefined,
      primaryPhone: input.primaryPhone || undefined,
      primaryStateCode: input.primaryStateCode,
      streetLineOne: input.streetLineOne,
      streetLineTwo: input.streetLineTwo,
      city: input.city,
      postalCode: input.postalCode,
      sourceSystem: input.sourceSystem || "manual",
      notes: input.notes,
      ...(input.contacts.length
        ? {
            contacts: input.contacts.map((c, index) => ({
              firstName: c.firstName,
              lastName: c.lastName,
              email: c.email || undefined,
              phone: c.phone || undefined,
              relationship: c.relationship,
              isPrimary: c.isPrimary || index === 0,
            })),
          }
        : {}),
    });

    response.status(201).json({
      id: result.id,
      accountCode: result.accountCode,
      displayName: result.displayName,
      primaryEmail: result.primaryEmail,
      primaryPhone: result.primaryPhone,
      contacts: result.contacts,
    });
  })
);

agencyRouter.patch(
  "/insureds/:insuredAccountId",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "insureds.manage");

    const input = insuredMutationSchema.partial().parse(request.body);
    const insuredAccountId = getRouteParam(request.params.insuredAccountId, "insuredAccountId");

    // Update account-level fields via service
    const result = await updateInsured(auth.activeAgencyId, insuredAccountId, {
      accountCode: input.accountCode,
      displayName: input.displayName,
      primaryEmail: input.primaryEmail !== undefined ? (input.primaryEmail || null) : undefined,
      primaryPhone: input.primaryPhone !== undefined ? (input.primaryPhone || null) : undefined,
      primaryStateCode: input.primaryStateCode !== undefined
        ? (input.primaryStateCode || null)
        : undefined,
      streetLineOne: input.streetLineOne !== undefined ? (input.streetLineOne || null) : undefined,
      streetLineTwo: input.streetLineTwo !== undefined ? (input.streetLineTwo || null) : undefined,
      city: input.city !== undefined ? (input.city || null) : undefined,
      postalCode: input.postalCode !== undefined ? (input.postalCode || null) : undefined,
      sourceSystem: input.sourceSystem !== undefined ? (input.sourceSystem || null) : undefined,
      notes: input.notes !== undefined ? (input.notes || null) : undefined,
    });

    // Handle batch contact upsert (route-specific pattern)
    if (input.contacts) {
      for (const contact of input.contacts) {
        if (contact.id) {
          await updateContact(auth.activeAgencyId, insuredAccountId, contact.id, {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email !== undefined ? (contact.email || undefined) : undefined,
            phone: contact.phone !== undefined ? (contact.phone || undefined) : undefined,
            relationship: contact.relationship,
            isPrimary: contact.isPrimary,
          });
        } else {
          await addContact(auth.activeAgencyId, insuredAccountId, {
            firstName: contact.firstName || "",
            lastName: contact.lastName || "",
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            relationship: contact.relationship,
            isPrimary: contact.isPrimary,
          });
        }
      }
    }

    // Re-fetch with contacts for response
    const updated = await prisma.insuredAccount.findUniqueOrThrow({
      where: { id: insuredAccountId },
      include: { contacts: { orderBy: { isPrimary: "desc" } } },
    });

    response.json({
      id: updated.id,
      accountCode: updated.accountCode,
      displayName: updated.displayName,
      primaryEmail: updated.primaryEmail,
      primaryPhone: updated.primaryPhone,
      contacts: updated.contacts,
    });
  })
);

agencyRouter.delete(
  "/insureds/:insuredAccountId",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "insureds.manage");

    const insuredAccountId = getRouteParam(request.params.insuredAccountId, "insuredAccountId");
    await deleteInsured(auth.activeAgencyId, insuredAccountId);
    response.json({ ok: true });
  })
);

agencyRouter.delete(
  "/insureds/:insuredAccountId/contacts/:contactId",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "insureds.manage");

    const insuredAccountId = getRouteParam(request.params.insuredAccountId, "insuredAccountId");
    const contactId = getRouteParam(request.params.contactId, "contactId");
    await deleteContact(auth.activeAgencyId, insuredAccountId, contactId);
    response.json({ ok: true });
  })
);

agencyRouter.get(
  "/policies",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "policies.manage");

    const input = policySearchSchema.parse(request.query);

    const policies = await prisma.policy.findMany({
      where: {
        agencyId: auth.activeAgencyId,
        ...(input.insuredAccountId ? { insuredAccountId: input.insuredAccountId } : {})
      },
      include: {
        insuredAccount: true,
        carrier: true,
        policyType: true,
        declarationPages: {
          where: {
            isActive: true
          },
          include: {
            document: true
          }
        },
        formSelections: {
          include: {
            offeringForm: true
          }
        }
      },
      orderBy: [{ expirationDate: "asc" }, { createdAt: "desc" }],
    });

    response.json({
      items: policies.map((policy) => ({
        id: policy.id,
        insuredAccountId: policy.insuredAccountId,
        insuredDisplayName: policy.insuredAccount.displayName,
        policyNumber: policy.policyNumber,
        status: policy.status,
        premium: policy.premium,
        effectiveDate: policy.effectiveDate,
        expirationDate: policy.expirationDate,
        readinessSource: policy.readinessSource,
        readinessConfirmedAt: policy.readinessConfirmedAt,
        carrierName: policy.carrier?.name ?? policy.extractedCarrierName,
        policyTypeName: policy.policyType.name,
        activeDeclarationPage: policy.declarationPages[0]
          ? {
              id: policy.declarationPages[0].id,
              extractionStatus: policy.declarationPages[0].extractionStatus,
              confidence: policy.declarationPages[0].confidence,
              documentPath: policy.declarationPages[0].document.storagePath
            }
          : null,
        forms: policy.formSelections.map((selection) => ({
          id: selection.id,
          title: selection.offeringForm.title,
          formNumber: selection.offeringForm.formNumber,
          source: selection.source,
          limitText: selection.limitText
        }))
      }))
    });
  })
);

agencyRouter.get(
  "/policies/:policyId",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "policies.manage");

    const policyId = getRouteParam(request.params.policyId, "policyId");
    const policy = await prisma.policy.findFirst({
      where: {
        id: policyId,
        agencyId: auth.activeAgencyId
      },
      include: {
        insuredAccount: true,
        carrier: true,
        state: true,
        policyType: true,
        declarationPages: {
          include: {
            document: true
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        formSelections: {
          include: {
            offeringForm: true
          },
          orderBy: {
            selectedAt: "desc"
          }
        },
        coverages: {
          orderBy: { sortOrder: "asc" }
        },
        reviewSessions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 10
        },
        tasks: {
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 10
        },
        notes: {
          orderBy: {
            createdAt: "desc"
          },
          take: 10
        }
      }
    });

    if (!policy) {
      throw new HttpError(404, "Policy not found for the active agency.");
    }

    const recommendations = await prisma.agencyRecommendation.findMany({
      where: {
        agencyId: auth.activeAgencyId,
        policyTypeId: policy.policyTypeId
      },
      include: {
        coverageDefinition: true
      },
      orderBy: {
        title: "asc"
      }
    });

    response.json({
      policy: {
        id: policy.id,
        insuredAccountId: policy.insuredAccountId,
        insuredDisplayName: policy.insuredAccount.displayName,
        policyNumber: policy.policyNumber,
        status: policy.status,
        premium: policy.premium,
        deductible: policy.deductible,
        effectiveDate: policy.effectiveDate,
        expirationDate: policy.expirationDate,
        policyFormCode: policy.policyFormCode,
        readinessSource: policy.readinessSource,
        readinessConfirmedAt: policy.readinessConfirmedAt,
        carrierName: policy.carrier?.name ?? policy.extractedCarrierName,
        stateCode: policy.state?.code ?? null,
        policyTypeName: policy.policyType.name,
        producerName: policy.producerName,
        locationName: policy.locationName,
        mortgagee: policy.mortgagee,
        propertyStreet: policy.propertyStreet,
        propertyCity: policy.propertyCity,
        propertyStateCode: policy.propertyStateCode,
        propertyPostalCode: policy.propertyPostalCode,
        propertyCounty: policy.propertyCounty,
        decForms: policy.decForms,
        declarationPages: policy.declarationPages.map((page) => ({
          id: page.id,
          isActive: page.isActive,
          extractionStatus: page.extractionStatus,
          confidence: page.confidence,
          uploadedAt: page.createdAt,
          documentPath: page.document.storagePath
        })),
        forms: policy.formSelections.map((selection) => ({
          id: selection.id,
          title: selection.offeringForm.title,
          formNumber: selection.offeringForm.formNumber,
          source: selection.source,
          limitText: selection.limitText
        })),
        coverages: policy.coverages.map((cov) => ({
          id: cov.id,
          section: cov.section,
          label: cov.label,
          coverageCode: cov.coverageCode,
          limitAmount: cov.limitAmount,
          limitText: cov.limitText,
          premiumAmount: cov.premiumAmount,
          premiumText: cov.premiumText,
          deductible: cov.deductible,
          source: cov.source,
        })),
        recommendations: recommendations.map((recommendation) => ({
          id: recommendation.id,
          title: recommendation.title,
          type: recommendation.type,
          description: recommendation.description,
          minimumLimitText: recommendation.minimumLimitText,
          coverageName: recommendation.coverageDefinition?.name ?? null
        })),
        tasks: policy.tasks,
        notes: policy.notes,
        reviewSessions: policy.reviewSessions
      }
    });
  })
);

agencyRouter.post(
  "/policies",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "policies.manage");

    const input = policyMutationSchema.parse(request.body);

    // Resolve carrier slug to id (route uses slug, service uses id or name)
    let carrierId: string | undefined;
    if (input.carrierSlug) {
      const carrier = await prisma.carrier.findUnique({
        where: { slug: input.carrierSlug },
      });
      if (!carrier) {
        throw new HttpError(400, "Carrier slug is invalid.");
      }
      carrierId = carrier.id;
    }

    const policy = await createPolicy(auth.activeAgencyId, {
      insuredAccountId: input.insuredAccountId,
      policyTypeCode: input.policyTypeCode,
      policyNumber: input.policyNumber,
      carrierId,
      status: input.status,
      effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate,
      premium: input.premium !== undefined ? String(input.premium) : undefined,
      stateCode: input.stateCode,
      readinessSource: input.readinessSource,
      extractedCarrierName: input.extractedCarrierName,
      producerName: input.producerName,
      locationName: input.locationName,
    });

    response.status(201).json({
      id: policy.id,
      insuredDisplayName: policy.insuredAccount.displayName,
      policyNumber: policy.policyNumber,
      status: policy.status,
      carrierName: policy.carrier?.name ?? policy.extractedCarrierName,
      policyTypeName: policy.policyType.name,
    });
  })
);

agencyRouter.patch(
  "/policies/:policyId",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "policies.manage");

    const input = policyMutationSchema.partial().parse(request.body);
    const policyId = getRouteParam(request.params.policyId, "policyId");

    // Resolve carrier slug to id (route uses slug, service uses id or name)
    let carrierId: string | null | undefined;
    if (input.carrierSlug !== undefined) {
      if (input.carrierSlug) {
        const carrier = await prisma.carrier.findUnique({
          where: { slug: input.carrierSlug },
        });
        if (!carrier) {
          throw new HttpError(400, "Carrier slug is invalid.");
        }
        carrierId = carrier.id;
      } else {
        carrierId = null; // clear carrier
      }
    }

    // Verify insured ownership if reassigning
    if (input.insuredAccountId) {
      await requireAgencyOwnedInsured(auth.activeAgencyId, input.insuredAccountId);
    }

    const updated = await updatePolicy(auth.activeAgencyId, policyId, {
      insuredAccountId: input.insuredAccountId,
      policyTypeCode: input.policyTypeCode,
      policyNumber: input.policyNumber,
      carrierId,
      status: input.status,
      effectiveDate: input.effectiveDate !== undefined
        ? (input.effectiveDate || null)
        : undefined,
      expirationDate: input.expirationDate !== undefined
        ? (input.expirationDate || null)
        : undefined,
      premium: input.premium !== undefined
        ? (input.premium ? String(input.premium) : null)
        : undefined,
      stateCode: input.stateCode !== undefined
        ? (input.stateCode || null)
        : undefined,
      readinessSource: input.readinessSource,
      extractedCarrierName: input.extractedCarrierName !== undefined
        ? (input.extractedCarrierName || null)
        : undefined,
      producerName: input.producerName !== undefined
        ? (input.producerName || null)
        : undefined,
      locationName: input.locationName !== undefined
        ? (input.locationName || null)
        : undefined,
    });

    response.json({
      id: updated.id,
      insuredDisplayName: updated.insuredAccount.displayName,
      policyNumber: updated.policyNumber,
      status: updated.status,
      carrierName: updated.carrier?.name ?? updated.extractedCarrierName,
      policyTypeName: updated.policyType.name,
      readinessSource: updated.readinessSource,
    });
  })
);

agencyRouter.delete(
  "/policies/:policyId",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "policies.manage");

    const policyId = getRouteParam(request.params.policyId, "policyId");
    await deletePolicy(auth.activeAgencyId, policyId);
    response.json({ ok: true });
  })
);

agencyRouter.get(
  "/tasks",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);

    const tasks = await prisma.reviewTask.findMany({
      where: {
        agencyId: auth.activeAgencyId,
        status: {
          in: ["OPEN", "IN_PROGRESS", "BLOCKED"]
        }
      },
      include: {
        insuredAccount: true,
        policy: {
          include: {
            policyType: true
          }
        },
        reviewSession: true
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 25
    });

    response.json({
      items: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        type: task.type,
        status: task.status,
        dueAt: task.dueAt,
        insuredDisplayName: task.insuredAccount.displayName,
        policyTypeName: task.policy?.policyType.name ?? null,
        reviewSessionId: task.reviewSessionId
      }))
    });
  })
);

agencyRouter.patch(
  "/tasks/:taskId",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    const input = taskStatusSchema.parse(request.body);
    const taskId = getRouteParam(request.params.taskId, "taskId");
    const task = await requireAgencyOwnedTask(auth.activeAgencyId, taskId);

    const updated = await prisma.reviewTask.update({
      where: {
        id: task.id
      },
      data: {
        status: input.status,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
        ...(input.status === "CLOSED" ? { closedAt: new Date() } : { closedAt: null })
      },
      include: {
        insuredAccount: true,
        policy: {
          include: {
            policyType: true
          }
        }
      }
    });

    response.json({
      id: updated.id,
      status: updated.status,
      closedAt: updated.closedAt,
      insuredDisplayName: updated.insuredAccount.displayName,
      policyTypeName: updated.policy?.policyType.name ?? null
    });
  })
);

agencyRouter.patch(
  "/reviews/:reviewSessionId",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    const input = reviewStatusSchema.parse(request.body);
    const reviewSessionId = getRouteParam(request.params.reviewSessionId, "reviewSessionId");
    const review = await requireAgencyOwnedReview(auth.activeAgencyId, reviewSessionId);

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.reviewSession.update({
        where: {
          id: review.id
        },
        data: {
          status: input.status,
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.status === "IN_PROGRESS" && !review.startedAt ? { startedAt: new Date() } : {}),
          ...(input.status === "AWAITING_AGENCY" ? { completedAt: new Date() } : {}),
          ...(input.status === "CLOSED" ? { closedAt: new Date() } : {})
        }
      });

      if (input.closeOpenTasks && input.status === "CLOSED") {
        await tx.reviewTask.updateMany({
          where: {
            reviewSessionId: review.id,
            status: {
              in: ["OPEN", "IN_PROGRESS", "BLOCKED"]
            }
          },
          data: {
            status: "CLOSED",
            closedAt: new Date()
          }
        });
      }

      return saved;
    });

    response.json({
      id: updated.id,
      status: updated.status,
      summary: updated.summary,
      completedAt: updated.completedAt,
      closedAt: updated.closedAt
    });
  })
);

agencyRouter.post(
  "/notes",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    const input = noteCreateSchema.parse(request.body);

    await requireAgencyOwnedInsured(auth.activeAgencyId, input.insuredAccountId);

    if (input.policyId) {
      await requireAgencyOwnedPolicy(auth.activeAgencyId, input.policyId);
    }

    if (input.reviewSessionId) {
      await requireAgencyOwnedReview(auth.activeAgencyId, input.reviewSessionId);
    }

    const note = await prisma.activityNote.create({
      data: {
        agencyId: auth.activeAgencyId,
        insuredAccountId: input.insuredAccountId,
        ...(input.policyId ? { policyId: input.policyId } : {}),
        ...(input.reviewSessionId ? { reviewSessionId: input.reviewSessionId } : {}),
        createdByUserId: auth.id,
        source: "AGENCY_USER",
        title: input.title,
        body: input.body
      }
    });

    response.status(201).json({
      id: note.id,
      title: note.title,
      body: note.body,
      createdAt: note.createdAt
    });
  })
);

// ---------------------------------------------------------------------------
// Coverage Settings (availability matrix)
// ---------------------------------------------------------------------------

agencyRouter.get(
  "/coverage-settings",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);

    const settings = await prisma.agencyCoverageSetting.findMany({
      where: {
        appointment: { agencyId: auth.activeAgencyId },
      },
      include: {
        appointment: {
          include: {
            carrier: { select: { id: true, name: true } },
            state: { select: { id: true, code: true, name: true } },
          },
        },
        coverageDefinition: { select: { id: true, code: true, name: true, kind: true } },
        policyType: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { policyType: { name: "asc" } },
        { coverageDefinition: { name: "asc" } },
      ],
    });

    response.json({
      items: settings.map((s) => ({
        id: s.id,
        agencyCarrierAppointmentId: s.agencyCarrierAppointmentId,
        carrierId: s.appointment.carrier.id,
        carrierName: s.appointment.carrier.name,
        stateCode: s.appointment.state?.code ?? null,
        stateName: s.appointment.state?.name ?? null,
        coverageDefinitionId: s.coverageDefinitionId,
        coverageDefinitionCode: s.coverageDefinition.code,
        coverageDefinitionName: s.coverageDefinition.name,
        coverageKind: s.coverageDefinition.kind,
        policyTypeId: s.policyTypeId,
        policyTypeName: s.policyType.name,
        isAvailable: s.isAvailable,
        limitTiers: s.limitTiers,
        defaultLimitValue: s.defaultLimitValue ? Number(s.defaultLimitValue) : null,
        notes: s.notes,
      })),
    });
  })
);

const agencyCoverageSettingUpsertSchema = z.object({
  items: z.array(
    z.object({
      agencyCarrierAppointmentId: z.string(),
      coverageDefinitionId: z.string(),
      policyTypeId: z.string(),
      isAvailable: z.boolean(),
      limitTiers: z
        .array(z.object({ value: z.number(), label: z.string() }))
        .nullable()
        .optional(),
      defaultLimitValue: z.number().nullable().optional(),
      notes: z.string().trim().nullable().optional(),
    })
  ),
});

agencyRouter.put(
  "/coverage-settings",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "agency.settings.manage");

    const input = agencyCoverageSettingUpsertSchema.parse(request.body);

    // Verify all appointments belong to this agency
    const appointmentIds = [...new Set(input.items.map((i) => i.agencyCarrierAppointmentId))];
    const appointments = await prisma.agencyCarrierAppointment.findMany({
      where: { id: { in: appointmentIds }, agencyId: auth.activeAgencyId },
    });
    if (appointments.length !== appointmentIds.length) {
      throw new HttpError(400, "One or more appointments do not belong to this agency");
    }

    const results = await Promise.all(
      input.items.map((item) => {
        const optionals: Record<string, unknown> = {};
        if (item.limitTiers != null) optionals.limitTiers = item.limitTiers;
        if (item.defaultLimitValue != null) optionals.defaultLimitValue = item.defaultLimitValue;
        if (item.notes != null) optionals.notes = item.notes;

        return prisma.agencyCoverageSetting.upsert({
          where: {
            agencyCarrierAppointmentId_coverageDefinitionId_policyTypeId: {
              agencyCarrierAppointmentId: item.agencyCarrierAppointmentId,
              coverageDefinitionId: item.coverageDefinitionId,
              policyTypeId: item.policyTypeId,
            },
          },
          create: {
            agencyCarrierAppointmentId: item.agencyCarrierAppointmentId,
            coverageDefinitionId: item.coverageDefinitionId,
            policyTypeId: item.policyTypeId,
            isAvailable: item.isAvailable,
            ...optionals,
          },
          update: {
            isAvailable: item.isAvailable,
            ...optionals,
          },
        });
      })
    );

    response.json({ updated: results.length });
  })
);

agencyRouter.get(
  "/recommendations",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);

    const recommendations = await prisma.agencyRecommendation.findMany({
      where: {
        agencyId: auth.activeAgencyId
      },
      include: {
        policyType: true,
        coverageDefinition: true
      },
      orderBy: [{ policyType: { name: "asc" } }, { title: "asc" }]
    });

    response.json({
      items: recommendations.map((recommendation) => ({
        id: recommendation.id,
        title: recommendation.title,
        type: recommendation.type,
        description: recommendation.description,
        minimumLimitText: recommendation.minimumLimitText,
        policyTypeName: recommendation.policyType.name,
        coverageName: recommendation.coverageDefinition?.name ?? null
      }))
    });
  })
);

agencyRouter.get(
  "/settings",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);

    const agency = await prisma.agency.findUnique({
      where: {
        id: auth.activeAgencyId
      },
      include: {
        featureFlags: {
          include: {
            featureFlag: true
          }
        },
        notificationEndpoints: true,
        emailTemplates: true,
        policyTypeSettings: {
          include: {
            policyType: true
          }
        }
      }
    });

    if (!agency) {
      throw new HttpError(404, "The active agency could not be found.");
    }

    response.json({
      agency: {
        id: agency.id,
        name: agency.name,
        slug: agency.slug,
        status: agency.status,
        primaryEmail: agency.primaryEmail,
        primaryPhone: agency.primaryPhone,
        timezone: agency.timezone,
        planTier: agency.planTier,
        hasInAppAi: agency.hasInAppAi,
        settings: agency.settings
      },
      featureFlags: agency.featureFlags.map(({ featureFlag, enabled }) => ({
        key: featureFlag.key,
        name: featureFlag.name,
        enabled
      })),
      notificationEndpoints: agency.notificationEndpoints,
      emailTemplates: agency.emailTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        templateType: template.templateType,
        subject: template.subject,
        isActive: template.isActive
      })),
      policyTypes: agency.policyTypeSettings.map((setting) => ({
        id: setting.id,
        policyTypeCode: setting.policyType.code,
        policyTypeName: setting.policyType.name,
        enabled: setting.enabled,
        reviewConfig: setting.reviewConfig
      }))
    });
  })
);

// ===========================================================================
// AI Assistant
// ===========================================================================

const aiHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string(),
  tool_calls: z.array(z.object({
    id: z.string(),
    type: z.literal("function"),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
  tool_call_id: z.string().optional(),
});

const aiScreenContextSchema = z.object({
  screen: z.string().optional(),
  insuredAccountId: z.string().optional(),
  policyId: z.string().optional(),
}).optional().default({});

const aiChatSchema = z.object({
  message: z.string().trim().min(1),
  history: z.array(aiHistoryMessageSchema).default([]),
  screenContext: aiScreenContextSchema,
});

const aiToolConfirmSchema = z.object({
  toolCallId: z.string().min(1),
  toolName: z.string().min(1),
  args: z.record(z.unknown()),
  history: z.array(aiHistoryMessageSchema).default([]),
  screenContext: aiScreenContextSchema,
});

// ---------------------------------------------------------------------------
// Shared AI helper: auto-execute get_tool calls, return on execute_tool or message
// ---------------------------------------------------------------------------

const MAX_AUTO_TOOL_CALLS = 5;

type ResolvedAiResult =
  | { type: "message"; content: string }
  | { type: "execute_tool"; content: string; toolCallId: string; toolKey: string; payload: Record<string, unknown> };

async function resolveToolCalls(
  messages: ChatMessage[],
  toolCtx: ToolContext,
  agencyId: string,
  usageContext: ChatCompletionUsageContext,
): Promise<ResolvedAiResult> {
  let loops = 0;

  while (loops <= MAX_AUTO_TOOL_CALLS) {
    const result = await chatCompletion({
      messages,
      tools: metaTools,
      usageContext: {
        ...usageContext,
        meta: {
          ...(usageContext.meta ?? {}),
          autoToolLoop: loops,
        },
      },
    });

    if (result.toolCalls.length === 0) {
      return { type: "message", content: result.content };
    }

    const tc = result.toolCalls[0]!;
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { /* empty */ }

    // Auto-execute read-only tools (get_tool, search_data)
    if (tc.function.name === "get_tool" || tc.function.name === "search_data") {
      const toolResult = tc.function.name === "get_tool"
        ? await getToolSchema(args.toolKey as string, toolCtx)
        : await executeSearch(agencyId, args);

      messages.push({
        role: "assistant",
        content: result.content || "",
        tool_calls: [{
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }],
      });
      messages.push({
        role: "tool",
        content: JSON.stringify(toolResult),
        tool_call_id: tc.id,
      });
      loops++;
      continue;
    }

    if (tc.function.name === "execute_tool") {
      return {
        type: "execute_tool",
        content: result.content,
        toolCallId: tc.id,
        toolKey: args.toolKey as string,
        payload: (args.payload ?? {}) as Record<string, unknown>,
      };
    }

    // Unknown meta-tool — treat as message
    return { type: "message", content: result.content };
  }

  // Exceeded loop limit
  return { type: "message", content: "I wasn't able to look up the tool information. Could you try again?" };
}

async function buildToolContext(agencyId: string, permissionKeys: string[], screen?: string | undefined): Promise<ToolContext> {
  const flags = await prisma.agencyFeatureFlag.findMany({
    where: { agencyId, enabled: true },
    include: { featureFlag: true },
  });
  return {
    agent: "agency_assistant",
    screen,
    featureFlags: new Set(flags.map((f) => f.featureFlag.key)),
    permissions: new Set(permissionKeys),
  };
}

async function buildSystemPrompt(
  basePrompt: string,
  toolCtx: ToolContext,
  screenContext: { screen?: string | undefined; insuredAccountId?: string | undefined; policyId?: string | undefined },
): Promise<string> {
  const catalog = await getToolCatalog(toolCtx);
  let prompt = basePrompt;
  if (catalog) {
    prompt += "\n\n" + catalog;
  }

  if (screenContext.screen) {
    prompt += `\n\nThe user is currently viewing: ${screenContext.screen}`;
    if (screenContext.insuredAccountId) {
      prompt += ` (insuredAccountId: ${screenContext.insuredAccountId})`;
    }
    if (screenContext.policyId) {
      prompt += ` (policyId: ${screenContext.policyId})`;
    }
  }

  return prompt;
}

function buildAgencyAiUsageContext(params: {
  agencyId: string;
  userId: string;
  userType: "AGENCY";
  route: string;
  screenContext: {
    screen?: string | undefined;
    insuredAccountId?: string | undefined;
    policyId?: string | undefined;
  };
  contextBlockKeys: string[];
  stage: "chat" | "confirm";
}): ChatCompletionUsageContext {
  const { agencyId, userId, userType, route, screenContext, contextBlockKeys, stage } = params;

  return {
    operation: "chat_completion",
    surface: "agency_assistant",
    userType,
    agencyId,
    userId,
    insuredAccountId: screenContext.insuredAccountId,
    policyId: screenContext.policyId,
    route,
    screen: screenContext.screen,
    meta: {
      stage,
      contextBlockCount: contextBlockKeys.length,
      contextBlockKeys,
      screenContext: {
        screen: screenContext.screen ?? null,
        insuredAccountId: screenContext.insuredAccountId ?? null,
        policyId: screenContext.policyId ?? null,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// POST /ai/chat
// ---------------------------------------------------------------------------

agencyRouter.post(
  "/ai/chat",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);

    const agency = await prisma.agency.findUniqueOrThrow({
      where: { id: auth.activeAgencyId },
      select: { hasInAppAi: true, planTier: true },
    });

    if (!agency.hasInAppAi) {
      throw new HttpError(403, "In-app AI is not enabled for this agency.");
    }

    const input = aiChatSchema.parse(request.body);
    const sc = input.screenContext ?? {};

    const toolCtx = await buildToolContext(auth.activeAgencyId, auth.permissionKeys, sc.screen);

    const assembled = await assembleContext({
      userId: auth.id,
      userType: auth.userType,
      agencyId: auth.activeAgencyId,
      agent: "agency_assistant",
      ...(sc.insuredAccountId ? { insuredAccountId: sc.insuredAccountId } : {}),
      ...(sc.policyId ? { policyId: sc.policyId } : {}),
    });

    const messages: ChatMessage[] = [
      { role: "system", content: await buildSystemPrompt(assembled.systemPrompt, toolCtx, sc) },
      ...input.history,
      { role: "user", content: input.message },
    ];

    const result = await resolveToolCalls(
      messages,
      toolCtx,
      auth.activeAgencyId,
      buildAgencyAiUsageContext({
        agencyId: auth.activeAgencyId,
        userId: auth.id,
        userType: auth.userType,
        route: "/api/agency/ai/chat",
        screenContext: sc,
        contextBlockKeys: assembled.blocks.map((block) => block.key),
        stage: "chat",
      }),
    );

    if (result.type === "execute_tool") {
      response.json({
        type: "tool_call",
        toolCallId: result.toolCallId,
        toolName: result.toolKey,
        args: result.payload,
        message: result.content,
      });
      return;
    }

    response.json({
      type: "message",
      message: result.content,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /ai/confirm
// ---------------------------------------------------------------------------

agencyRouter.post(
  "/ai/confirm",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);

    const agency = await prisma.agency.findUniqueOrThrow({
      where: { id: auth.activeAgencyId },
      select: { hasInAppAi: true, planTier: true },
    });

    if (!agency.hasInAppAi) {
      throw new HttpError(403, "In-app AI is not enabled for this agency.");
    }

    const input = aiToolConfirmSchema.parse(request.body);
    const sc = input.screenContext ?? {};

    const toolCtx = await buildToolContext(auth.activeAgencyId, auth.permissionKeys, sc.screen);

    const toolResult: ToolResult = await executeTool(
      input.toolName,
      auth.activeAgencyId,
      input.args as Record<string, unknown>,
      toolCtx,
    );

    const assembled = await assembleContext({
      userId: auth.id,
      userType: auth.userType,
      agencyId: auth.activeAgencyId,
      agent: "agency_assistant",
      ...(sc.insuredAccountId ? { insuredAccountId: sc.insuredAccountId } : {}),
      ...(sc.policyId ? { policyId: sc.policyId } : {}),
    });

    const messages: ChatMessage[] = [
      { role: "system", content: await buildSystemPrompt(assembled.systemPrompt, toolCtx, sc) },
      ...input.history,
      {
        role: "assistant",
        content: "",
        tool_calls: [{
          id: input.toolCallId,
          type: "function" as const,
          function: {
            name: "execute_tool",
            arguments: JSON.stringify({ toolKey: input.toolName, payload: input.args }),
          },
        }],
      },
      {
        role: "tool",
        content: JSON.stringify(toolResult),
        tool_call_id: input.toolCallId,
      },
    ];

    const result = await resolveToolCalls(
      messages,
      toolCtx,
      auth.activeAgencyId,
      buildAgencyAiUsageContext({
        agencyId: auth.activeAgencyId,
        userId: auth.id,
        userType: auth.userType,
        route: "/api/agency/ai/confirm",
        screenContext: sc,
        contextBlockKeys: assembled.blocks.map((block) => block.key),
        stage: "confirm",
      }),
    );

    response.json({
      type: "message",
      message: result.type === "message" ? result.content : result.content || "Action completed.",
      actionResult: toolResult,
    });
  })
);

// ===========================================================================
// Dec Page Extraction
// ===========================================================================

const agencyDecExtractionSchema = z.object({
  pageImages: z
    .array(z.string().min(1))
    .min(1, "At least one page image is required."),
  carrierName: z.string().optional(),
  stateCode: z.string().optional(),
  policyTypeCode: z.string().optional(),
});

agencyRouter.post(
  "/extract-dec-page",
  asyncHandler(async (request, response) => {
    const auth = await requireAgencyUser(request, response);
    requirePermission(response, "policies.manage");

    const input = agencyDecExtractionSchema.parse(request.body);

    const result = await extractDeclarationPage({
      pageImages: input.pageImages,
      carrierName: input.carrierName,
      stateCode: input.stateCode,
      policyTypeCode: input.policyTypeCode,
      agencyId: auth.activeAgencyId,
      userId: auth.id,
    });

    response.json(result);
  })
);
