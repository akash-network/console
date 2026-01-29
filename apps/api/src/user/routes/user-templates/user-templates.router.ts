import { Hono } from "hono";
import { container } from "tsyringe";

import { getCurrentUserId, optionalUserMiddleware, requiredUserMiddleware } from "@src/middlewares/userMiddleware";
import { UserController } from "@src/user/controllers/user/user.controller";

export const userTemplatesRouter = new Hono();

const userRequiredRouter = new Hono();
userRequiredRouter.use("*", requiredUserMiddleware);

const userOptionalRouter = new Hono();
userOptionalRouter.use("*", optionalUserMiddleware);

userOptionalRouter.get("/template/:id", async c => {
  const userId = getCurrentUserId(c);
  const templateId = c.req.param("id");

  try {
    const template = await container.resolve(UserController).getTemplateById(templateId, userId);
    return c.json(template);
  } catch (error: any) {
    if (error.message === "Invalid template id") {
      return c.text(error.message, 400);
    }
    return c.text(error.message || "Template not found", 404);
  }
});

userRequiredRouter.post("/saveTemplate", async c => {
  const userId = getCurrentUserId(c);
  const data = await c.req.json();

  try {
    const templateId = await container.resolve(UserController).saveTemplate(userId, data);
    return c.text(templateId);
  } catch (error: any) {
    return c.text(error.message || "Error saving template", 400);
  }
});

userRequiredRouter.post("/saveTemplateDesc", async c => {
  const userId = getCurrentUserId(c);
  const data = await c.req.json();

  await container.resolve(UserController).saveTemplateDesc(userId, data);
  return c.text("Saved");
});

userOptionalRouter.get("/templates/:username", async c => {
  const username = c.req.param("username");
  const userId = getCurrentUserId(c);

  try {
    const templates = await container.resolve(UserController).getTemplates(username, userId);
    return c.json(templates);
  } catch (error: any) {
    return c.text(error.message || "User not found.", 404);
  }
});

userRequiredRouter.delete("/deleteTemplate/:id", async c => {
  const userId = getCurrentUserId(c);
  const templateId = c.req.param("id");

  try {
    await container.resolve(UserController).deleteTemplate(userId, templateId);
    return c.text("Removed");
  } catch (error: any) {
    return c.text(error.message || "Error deleting template", 400);
  }
});

userRequiredRouter.get("/favoriteTemplates", async c => {
  const userId = getCurrentUserId(c);
  const templates = await container.resolve(UserController).getFavoriteTemplates(userId);
  return c.json(templates);
});

userRequiredRouter.post("/addFavoriteTemplate/:templateId", async c => {
  const userId = getCurrentUserId(c);
  const templateId = c.req.param("templateId");

  try {
    await container.resolve(UserController).addFavoriteTemplate(userId, templateId);
    return c.text("Added");
  } catch (error: any) {
    return c.text(error.message || "Error adding favorite", 400);
  }
});

userRequiredRouter.delete("/removeFavoriteTemplate/:templateId", async c => {
  const userId = getCurrentUserId(c);
  const templateId = c.req.param("templateId");

  try {
    await container.resolve(UserController).removeFavoriteTemplate(userId, templateId);
    return c.text("Removed");
  } catch (error: any) {
    return c.text(error.message || "Error removing favorite", 400);
  }
});

userTemplatesRouter.route("/", userOptionalRouter);
userTemplatesRouter.route("/", userRequiredRouter);
