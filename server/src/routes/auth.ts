import { createHash } from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import {
  createAgencySwitchSession,
  createMagicLinkSession,
  createPasswordSession,
  getSessionEnvelope,
  requestMagicLink
} from "../auth/session.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middleware/auth.js";

const passwordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  agencySlug: z.string().min(1).optional()
});

const magicLinkSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1)
});

const magicLinkRequestSchema = z.object({
  email: z.string().email()
});

const switchAgencySchema = z.object({
  agencySlug: z.string().min(1)
});

function hashMagicToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const input = passwordLoginSchema.parse(request.body);
    const session = await createPasswordSession({
      email: input.email,
      password: input.password,
      ...(input.agencySlug ? { agencySlug: input.agencySlug } : {})
    });

    response.json(session);
  })
);

authRouter.post(
  "/magic-link/request",
  asyncHandler(async (request, response) => {
    const input = magicLinkRequestSchema.parse(request.body);
    const result = await requestMagicLink({
      email: input.email
    });

    response.json(result);
  })
);

authRouter.post(
  "/magic-link/exchange",
  asyncHandler(async (request, response) => {
    const input = magicLinkSchema.parse(request.body);
    const session = await createMagicLinkSession({
      email: input.email,
      tokenHash: hashMagicToken(input.token)
    });

    response.json(session);
  })
);

authRouter.get(
  "/me",
  asyncHandler(async (request, response) => {
    const auth = await requireAuth(request, response);
    const session = await getSessionEnvelope(auth.id, auth.activeAgencyId);

    response.json(session);
  })
);

authRouter.post(
  "/switch-agency",
  asyncHandler(async (request, response) => {
    const auth = await requireAuth(request, response);
    const input = switchAgencySchema.parse(request.body);
    const session = await createAgencySwitchSession({
      userId: auth.id,
      agencySlug: input.agencySlug
    });

    response.json(session);
  })
);
