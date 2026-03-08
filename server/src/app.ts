import cors from "cors";
import express from "express";

import { authRouter } from "./routes/auth.js";
import { agencyRouter } from "./routes/agency.js";
import { insuredRouter } from "./routes/insured.js";
import { staffRouter } from "./routes/staff.js";
import { isHttpError } from "./lib/errors.js";
import { ServiceError } from "./services/errors.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      service: "prism-server"
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/agency", agencyRouter);
  app.use("/api/insured", insuredRouter);
  app.use("/api/staff", staffRouter);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (isHttpError(error)) {
      response.status(error.statusCode).json({
        error: error.message,
        details: error.details
      });
      return;
    }

    if (error instanceof ServiceError) {
      response.status(error.code).json({
        error: error.message
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: "Internal server error"
    });
  });

  return app;
}
