import "reflect-metadata";

import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { container } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";

dotenvExpand.expand(dotenv.config({ path: "env/.env.unit.test" }));
container.register(RAW_APP_CONFIG, { useValue: process.env });
