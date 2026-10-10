import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

if (process.env.VERCEL_ENV !== "production") {
  process.exit(0);
}

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
  console.error("Production database URLs are missing; refusing to build.");
  process.exit(1);
}

const prisma = resolve("node_modules/.bin/prisma");
const result = spawnSync(prisma, ["migrate", "status"], {
  encoding: "utf8",
  env: process.env,
});

if (result.error || result.status !== 0) {
  console.error(
    "Production database migrations are pending or migration status could not be verified; refusing to build.",
  );
  process.exit(1);
}

console.log("Production database schema is current.");
