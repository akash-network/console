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
config("env/.env.local");
config("env/.env");

const deploymentEnv = process.env.DEPLOYMENT_ENV;

if (deploymentEnv && deploymentEnv !== "local") {
  config(`env/.env.${deploymentEnv}`);
}

const network = process.env.NETWORK;
config(`env/.env.${network}`);

logger.info(`Loaded env files: ${files.join(", ")}`);
