import { Hono } from "hono";

export const legacyRouter = new Hono();

legacyRouter.get("/v1/templates-list.json", async c => {
  return c.redirect("/v1/templates-list", 302);
});

legacyRouter.get("/v1/templates/:id{.+\\.json}", async c => {
  const id = c.req.param("id");
  const templateId = id.slice(0, -5); // Remove ".json" suffix
  const queryString = new URL(c.req.url).search;
  return c.redirect(`/v1/templates/${templateId}${queryString}`, 302);
});
