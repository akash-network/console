import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/model-schemas",
  out: "./drizzle",
  dialect: "postgresql"
});
