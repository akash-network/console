import { LoggerService } from "@akashnetwork/logging";
import type { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";

const logger = LoggerService.forContext("api/config");
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!serverEnvConfig.UI_TESTS_TOKEN && serverEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED) {
    logger.warn(`UI_TESTS_TOKEN is not set, but turnstile protection is enabled.` + `It means UI tests will not be able to pass the turnstile protection.`);
  }

  res.status(200).json({
    TURNSTILE_SITE_KEY:
      serverEnvConfig.UI_TESTS_TOKEN && req.headers["x-ui-tests-token"] === serverEnvConfig.UI_TESTS_TOKEN
        ? serverEnvConfig.TURNSTILE_TEST_SITE_KEY
        : serverEnvConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  });
}
