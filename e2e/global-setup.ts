import { execSync } from "node:child_process";

/**
 * Apply migrations and reseed so every run starts from the known demo dataset
 * (admin@bugboard.dev / alice / bob). Runs once before the suite.
 */
export default async function globalSetup() {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  execSync("npx prisma db seed", { stdio: "inherit" });
}
