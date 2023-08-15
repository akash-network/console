import { env } from "@src/shared/utils/env";

export function privateMiddleware(req, res, next) {
  if (!env.SecretToken) {
    next();
  } else if (req.query.token === env.SecretToken) {
    next();
  } else {
    res.status(401).send("Unauthorized");
  }
}
