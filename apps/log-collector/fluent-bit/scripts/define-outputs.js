const path = require("path");
const fs = require("fs");
const { z } = require("zod");

/**
 * Command line argument for the destination fluent-bit configuration file
 * @type {string}
 */
const [destination] = process.argv.slice(2);

/**
 * Base fluent-bit configuration content
 * @type {string}
 */
let config = fs.readFileSync(path.join(__dirname, "..", "fluent-bit.conf"), "utf8");

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

// Write the final configuration to the destination file
fs.writeFileSync(destination, config);
