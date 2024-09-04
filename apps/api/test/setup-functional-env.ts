import "reflect-metadata";

import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

dotenvExpand.expand(dotenv.config({ path: "env/.env.functional.test" }));
