const path = require("path");
const fs = require("fs");
const { z } = require("zod");

/**
 * Base fluent-bit configuration content
 * @type {string}
 */
let config = fs.readFileSync(path.join(__dirname, "..", "base-fluent-bit.conf"), "utf8");

/**
 * Zod schema for stdout output configuration
 * Requires STDOUT environment variable to be set to "true"
 * @type {import('zod').ZodObject}
 */
const stdOutEnvSchema = z.object({
  STDOUT: z.enum(["true"])
});

/**
 * Zod schema for Datadog output configuration
 * Requires DD_SITE and DD_API_KEY environment variables
 * @type {import('zod').ZodObject}
 */
const ddEnvSchema = z.object({
  DD_SITE: z.string(),
  DD_API_KEY: z.string()
});

// Add outputs based on environment configuration
addOutput(stdOutEnvSchema, "./outputs/stdout.conf");
addOutput(ddEnvSchema, "./outputs/datadog.conf");

/**
 * Conditionally adds an output configuration to the fluent-bit config
 * based on environment variable validation
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate environment variables
 * @param {string} outputPath - Path to the output configuration file to include
 */
function addOutput(schema, outputPath) {
  const result = schema.safeParse(process.env);

  if (result.success) {
    config += `\n@INCLUDE ${outputPath}`;
  }
}

const outputPath = path.join(__dirname, "..", "..", "dist", "fluent-bit.conf");
const destDir = path.dirname(outputPath);

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.writeFileSync(outputPath, config);
