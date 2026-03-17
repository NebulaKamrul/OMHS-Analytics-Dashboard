import app from "./app";
import { initDb } from "./initDb";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Open the port immediately so Cloud Run / health checks pass right away.
// Database seeding runs in the background and does not block startup.
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  initDb().catch((err) => {
    console.error("[initDb] Background seed failed:", err);
    // Non-fatal: server stays up, API endpoints return empty results
    // until data is available on the next restart.
  });
});
