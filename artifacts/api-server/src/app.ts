import express, { type Express, type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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

// Any unmatched /api/* route returns JSON (never Express's default HTML 404),
// so API clients always get a parseable response.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Static web app (co-hosted single-service deploy) ──────────────────────────
// In production the built React SPA (artifacts/web/dist/public) is served by
// this same server, so one host serves both the API (/api/*) and the web app.
// Path is resolved relative to the bundled server file, overridable via
// WEB_DIST_PATH for non-standard layouts. If the build isn't present (e.g. API
// running standalone in dev), this block is skipped silently.
const thisDir = path.dirname(fileURLToPath(import.meta.url));
const webDist =
  process.env["WEB_DIST_PATH"] ??
  path.resolve(thisDir, "../../web/dist/public");

if (fs.existsSync(path.join(webDist, "index.html"))) {
  const indexHtml = path.join(webDist, "index.html");
  logger.info({ webDist }, "Serving static web app");

  app.use(express.static(webDist, { index: false }));

  // SPA fallback: any non-API GET returns index.html so client-side routing works.
  app.get(/^\/(?!api\/).*/, (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    res.sendFile(indexHtml);
  });
}

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
