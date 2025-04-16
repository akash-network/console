import type { NextApiRequest, NextApiResponse } from "next";

import { createRequestExecutionContext, requestExecutionContext } from "./requestExecutionContext";

export function wrapApiHandlerInExecutionContext(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    return await requestExecutionContext.run(createRequestExecutionContext(req), async () => await handler(req, res));
  };
}
