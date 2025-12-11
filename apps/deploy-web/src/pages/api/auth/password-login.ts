import { z } from "zod";

import { setSession } from "@src/lib/auth0/setSession/setSession";
import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";

export default defineApiHandler({
  route: "/api/auth/password-login",
  schema: z.object({
    body: z.object({
      email: z.string().email(),
      password: z.string()
    })
  }),
  async handler({ res, req, services }) {
    const result = await services.sessionService.signIn({
      email: req.body.email,
      password: req.body.password
    });

    if (result.ok) {
      await setSession(req, res, result.val);
      res.status(204).json(null);
      return;
    }

    return res.status(400).json(result.val);
  }
});
