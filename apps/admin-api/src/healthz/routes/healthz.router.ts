import { Hono } from "hono";

export const healthzRouter = new Hono();

healthzRouter.get("/healthz", c => {
  return c.json({ status: "ok" });
});
