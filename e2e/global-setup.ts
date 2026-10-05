import { seedE2E } from "../prisma/e2e-seed";

export default async function globalSetup() {
  await seedE2E();
}
