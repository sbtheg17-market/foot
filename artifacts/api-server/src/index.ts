import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!process.env["JWT_SECRET"]) {
  throw new Error(
    "JWT_SECRET environment variable is required but was not provided (every login would fail with 500).",
  );
}

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
