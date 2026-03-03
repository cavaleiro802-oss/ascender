import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ||
  `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:${process.env.MYSQLPORT || "3306"}/${process.env.MYSQLDATABASE}`;

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: { url },
});
