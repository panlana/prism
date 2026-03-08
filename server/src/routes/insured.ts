import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/db.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/errors.js";
import { requireInsuredUser } from "../middleware/auth.js";
import { startReviewChat, sendReviewMessage, getReviewTranscript } from "../ai/chat.js";
import type { ConversationContext } from "../ai/context/types.js";

export const insuredRouter = Router();

function getRouteParam(value: string | string[] | undefined, label: string) {
  if (!value || Array.isArray(value)) {
    throw new HttpError(400, `Invalid route parameter: ${label}`);
  }
  return value;
}

insuredRouter.get(
  "/overview",
  asyncHandler(async (request, response) => {
    const auth = await requireInsuredUser(request, response);

    const contacts = await prisma.insuredContact.findMany({
      where: {
        userId: auth.id
      },
      include: {
        insuredAccount: {
          include: {
            agency: true,
            policies: {
              include: {
                policyType: true,
                carrier: true,
                declarationPages: {
                  where: {
                    isActive: true
                  }
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
              orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }]
            },
            reviewSessions: {
              orderBy: {
                createdAt: "desc"
              },
              take: 10
            }
          }
        }
      },
      orderBy: {
        isPrimary: "desc"
      }
    });

    response.json({
      items: contacts.map((contact) => ({
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          isPrimary: contact.isPrimary
        },
        account: {
          id: contact.insuredAccount.id,
          accountCode: contact.insuredAccount.accountCode,
          displayName: contact.insuredAccount.displayName,
          agencyName: contact.insuredAccount.agency.name,
          agencySlug: contact.insuredAccount.agency.slug,
          policies: contact.insuredAccount.policies.map((policy) => ({
            id: policy.id,
            policyNumber: policy.policyNumber,
            status: policy.status,
            premium: policy.premium,
            effectiveDate: policy.effectiveDate,
            expirationDate: policy.expirationDate,
            readinessSource: policy.readinessSource,
            isReviewReady: policy.declarationPages.length > 0 || policy.readinessSource === "AMS",
            policyTypeName: policy.policyType.name,
            carrierName: policy.carrier?.name ?? policy.extractedCarrierName
          })),
          openTasks: contact.insuredAccount.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            type: task.type,
            dueAt: task.dueAt
          })),
          recentReviews: contact.insuredAccount.reviewSessions.map((review) => ({
            id: review.id,
            status: review.status,
            summary: review.summary,
            createdAt: review.createdAt,
            completedAt: review.completedAt
          }))
        }
      }))
    });
  })
);

// --- Policy Review Chat ---

const startReviewSchema = z.object({
  reviewType: z.enum(["thorough", "core", "recommendations_only"]).optional(),
  model: z.string().optional(),
});

insuredRouter.post(
  "/review/:policyId/start",
  asyncHandler(async (request, response) => {
    const auth = await requireInsuredUser(request, response);
    const policyId = getRouteParam(request.params.policyId, "policyId");
    const body = startReviewSchema.parse(request.body);

    const contact = await prisma.insuredContact.findFirst({
      where: { userId: auth.id },
      include: {
        insuredAccount: true,
      },
    });

    if (!contact) {
      throw new HttpError(404, "No insured account found for this user.");
    }

    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        policyType: true,
        carrier: true,
        state: true,
        declarationPages: { where: { isActive: true } },
      },
    });

    if (!policy || policy.insuredAccountId !== contact.insuredAccountId) {
      throw new HttpError(404, "Policy not found.");
    }

    const isReviewReady =
      policy.declarationPages.length > 0 ||
      policy.readinessSource === "AMS";

    if (!isReviewReady) {
      throw new HttpError(
        400,
        "This policy is not ready for review. A declarations page must be uploaded or AMS data must be available."
      );
    }

    let offeringId: string | undefined;
    if (policy.carrierId && policy.stateId) {
      const offering = await prisma.carrierPolicyOffering.findUnique({
        where: {
          carrierId_stateId_policyTypeId: {
            carrierId: policy.carrierId,
            stateId: policy.stateId,
            policyTypeId: policy.policyTypeId,
          },
        },
      });
      offeringId = offering?.id;
    }

    const session = await prisma.reviewSession.create({
      data: {
        agencyId: contact.insuredAccount.agencyId,
        insuredAccountId: contact.insuredAccountId,
        policyId: policy.id,
        initiatedByUserId: auth.id,
        channel: "INSURED_PORTAL",
        status: "STARTED",
        reviewType: body.reviewType ?? "thorough",
        startedAt: new Date(),
      },
    });

    const ctx: ConversationContext = {
      userId: auth.id,
      userType: "INSURED",
      agencyId: contact.insuredAccount.agencyId,
      agent: "insured_review",
      insuredAccountId: contact.insuredAccountId,
      policyId: policy.id,
      policyTypeId: policy.policyTypeId,
      carrierId: policy.carrierId ?? undefined,
      stateId: policy.stateId ?? undefined,
      offeringId,
    };

    const result = await startReviewChat({
      ctx,
      reviewSessionId: session.id,
      reviewType: body.reviewType ?? "thorough",
      ...(body.model ? { model: body.model } : {}),
    });

    response.json({
      sessionId: session.id,
      message: result.message,
      model: result.model,
      usage: result.usage,
    });
  })
);

insuredRouter.post(
  "/review/:sessionId/message",
  asyncHandler(async (request, response) => {
    const auth = await requireInsuredUser(request, response);
    const sessionId = getRouteParam(request.params.sessionId, "sessionId");
    const { message, model } = z
      .object({
        message: z.string().min(1).max(10000),
        model: z.string().optional(),
      })
      .parse(request.body);

    const session = await prisma.reviewSession.findUnique({
      where: { id: sessionId },
      include: {
        insuredAccount: {
          include: {
            contacts: { where: { userId: auth.id } },
          },
        },
      },
    });

    if (!session || session.insuredAccount.contacts.length === 0) {
      throw new HttpError(404, "Review session not found.");
    }

    if (session.status === "CLOSED") {
      throw new HttpError(400, "This review session is closed.");
    }

    const result = await sendReviewMessage({
      reviewSessionId: sessionId,
      userMessage: message,
      userId: auth.id,
      userType: auth.userType,
      agencyId: session.agencyId,
      insuredAccountId: session.insuredAccountId,
      policyId: session.policyId ?? undefined,
      meta: {
        sessionStatus: session.status,
      },
      ...(model ? { model } : {}),
    });

    response.json({
      message: result.message,
      model: result.model,
      usage: result.usage,
    });
  })
);

insuredRouter.get(
  "/review/:sessionId",
  asyncHandler(async (request, response) => {
    const auth = await requireInsuredUser(request, response);
    const sessionId = getRouteParam(request.params.sessionId, "sessionId");

    const session = await prisma.reviewSession.findUnique({
      where: { id: sessionId },
      include: {
        policy: {
          include: { policyType: true, carrier: true },
        },
        insuredAccount: {
          include: {
            contacts: { where: { userId: auth.id } },
          },
        },
        tasks: true,
      },
    });

    if (!session || session.insuredAccount.contacts.length === 0) {
      throw new HttpError(404, "Review session not found.");
    }

    const transcript = await getReviewTranscript(sessionId);

    response.json({
      id: session.id,
      status: session.status,
      reviewType: session.reviewType,
      policyType: session.policy?.policyType.name,
      carrier: session.policy?.carrier?.name,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      transcript: transcript
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
      tasks: session.tasks.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        title: t.title,
      })),
    });
  })
);
