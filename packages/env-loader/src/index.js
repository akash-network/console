const dotenv = require("@dotenvx/dotenvx");
const fs = require("fs");
const pino = require("pino");

const CUSTOM_LEVELS = {
  fatal: "critical"
};

const logger = pino(
  {
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: {
      level(label) {
        return { level: CUSTOM_LEVELS[label] || label };
      }
    }
  },
  pino.destination({ sync: true })
).child({ context: "ENV" });

const files = [];

const config = path => {
  if (fs.existsSync(path)) {
    dotenv.config({ path, logLevel: "error" });
    files.push(path);
  }
};

if (process.env.DEPLOYMENT_ENV === "") {
  delete process.env.DEPLOYMENT_ENV;
}

if (!process.env.DEPLOYMENT_ENV) {
  config("../../.env.local");
}

config(`env/.env.${process.env.DEPLOYMENT_ENV || "local"}`);
config(`env/.env.${process.env.NETWORK}`);
config("env/.env");

logger.info(`Loaded env files: ${files.join(", ")}`);
