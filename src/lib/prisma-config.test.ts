import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadConfigFromFile } from "@prisma/config";

// Exercises Prisma's actual configuration loader with the scoped deepmerge-ts
// security override. In addition, CI generates the client and applies migrations.
it("Prisma resolves schema and migration settings with the patched merger", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "onelegends-prisma-config-")));
  try {
    await writeFile(join(directory, "prisma.config.js"), `module.exports = {
      schema: 'schema.prisma',
      migrations: { path: 'migrations', seed: 'tsx prisma/seed.ts' }
    };`);
    const loaded = await loadConfigFromFile({ configRoot: directory });
    expect(loaded).not.toHaveProperty("error");
    expect(loaded.config).toMatchObject({
      schema: join(directory, "schema.prisma"),
      migrations: { path: join(directory, "migrations"), seed: "tsx prisma/seed.ts" },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
