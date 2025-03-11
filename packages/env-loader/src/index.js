const dotenv = require("@dotenvx/dotenvx");
const fs = require("fs");
const pino = require("pino");

const logger = pino(
  pino.destination({
    sync: true
  })
).child({ context: "ENV" });

const files = [];

const config = path => {
  if (fs.existsSync(path)) {
    dotenv.config({ path, logLevel: "error" });
    files.push(path);
  }
};

if (!process.env.DEPLOYMENT_ENV) {
  config("../../.env.local");
}
config(`env/.env.${process.env.DEPLOYMENT_ENV}`);
config(`env/.env.${process.env.NETWORK}`);
config("env/.env");

logger.info(`Loaded env files: ${files.join(", ")}`);
