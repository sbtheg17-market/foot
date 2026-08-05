import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Catch-all JSON error handler ──────────────────────────────────────────────
// Must be the last middleware (4 parameters). Express calls this whenever a
// route handler throws or calls next(err). Without this, Express 5 returns an
// HTML error page — which the UI cannot parse as JSON and silently ignores.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const status =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { status?: number; statusCode?: number }).statusCode ??
    500;

  const message =
    (err as { userMessage?: string; message?: string }).userMessage ??
    (err as { message?: string }).message ??
    "Internal server error";

  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");

  // Never leak stack traces to clients in production.
  res.status(status).json({
    error: status >= 500 ? "Internal server error" : message,
  });
});

export default app;
