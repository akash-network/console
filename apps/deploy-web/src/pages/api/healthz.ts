import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";

export default defineApiHandler({
  route: "/api/healthz",
  async handler({ res }) {
    res.status(200).json({ data: { status: "ok" } });
  }
});
