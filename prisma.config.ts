import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Match Next.js's env-file precedence (.env, then .env.local overriding it) so
// `prisma migrate`/`studio` run against the same DB as `next dev` — plain
// `dotenv/config` only reads .env.
config();
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
