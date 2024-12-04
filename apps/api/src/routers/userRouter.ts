import { Context, Hono } from "hono";
import assert from "http-assert";
import { container } from "tsyringe";
import * as uuid from "uuid";

import { AuthTokenService } from "@src/auth/services/auth-token/auth-token.service";
import { getCurrentUserId, optionalUserMiddleware, requiredUserMiddleware } from "@src/middlewares/userMiddleware";
import {
  addTemplateFavorite,
  deleteTemplate,
  getFavoriteTemplates,
  getTemplateById,
  getTemplates,
  removeTemplateFavorite,
  saveTemplate,
  saveTemplateDesc
} from "@src/services/db/templateService";
import { checkUsernameAvailable, getSettingsOrInit, getUserByUsername, subscribeToNewsletter, updateSettings } from "@src/services/db/userDataService";

export const userRouter = new Hono();

const userRequiredRouter = new Hono();
userRequiredRouter.use("*", requiredUserMiddleware);

const userOptionalRouter = new Hono();
userOptionalRouter.use("*", optionalUserMiddleware);

userOptionalRouter.get("/byUsername/:username", async c => {
  const username = c.req.param("username");

  const user = await getUserByUsername(username);

  if (!user) {
    return c.text("User not found", 404);
  }

  return c.json(user);
});

userRequiredRouter.post("/tokenInfo", async c => {
  const userId = getCurrentUserId(c);
  const { wantedUsername, email, emailVerified, subscribedToNewsletter } = await c.req.json();

  const settings = await getSettingsOrInit({
    anonymousUserId: await extractAnonymousUserId(c),
    userId: userId,
    wantedUsername,
    email: email,
    emailVerified: !!emailVerified,
    subscribedToNewsletter: subscribedToNewsletter
  });

  return c.json(settings);
});

async function extractAnonymousUserId(c: Context) {
  const anonymousBearer = c.req.header("x-anonymous-authorization");

  if (anonymousBearer) {
    const anonymousUserId = await container.resolve<any>(AuthTokenService).getValidUserId(anonymousBearer);
    assert(anonymousUserId, 401, "Invalid anonymous user token");

    return anonymousUserId;
  }
}

userRequiredRouter.put("/updateSettings", async c => {
  const userId = getCurrentUserId(c);
  const { username, subscribedToNewsletter, bio, youtubeUsername, twitterUsername, githubUsername } = await c.req.json();

  if (!/^[a-zA-Z0-9_-]*$/.test(username)) {
    return c.text("Username can only contain letters, numbers, dashes and underscores", 400);
  }

  await updateSettings(userId, username, subscribedToNewsletter, bio, youtubeUsername, twitterUsername, githubUsername);

  return c.text("Saved");
});

userOptionalRouter.get("/template/:id", async c => {
  const userId = getCurrentUserId(c);
  const templateId = c.req.param("id");

  if (!uuid.validate(templateId)) {
    return c.text("Invalid template id", 400);
  }

  const template = await getTemplateById(templateId, userId);

  if (!template) {
    return c.text("Template not found", 404);
  }

  return c.json(template);
});

userRequiredRouter.post("/saveTemplate", async c => {
  const userId = getCurrentUserId(c);
  const { id, sdl, isPublic, title, cpu, ram, storage } = await c.req.json();

  if (!sdl) {
    return c.text("Sdl is required", 400);
  }

  if (!title) {
    return c.text("Title is required", 400);
  }

  const templateId = await saveTemplate(id, userId, sdl, title, cpu, ram, storage, isPublic);

  return c.text(templateId);
});

userRequiredRouter.post("/saveTemplateDesc", async c => {
  const userId = getCurrentUserId(c);
  const { id, description } = await c.req.json();

  await saveTemplateDesc(id, userId, description);

  return c.text("Saved");
});

userOptionalRouter.get("/templates/:username", async c => {
  const username = c.req.param("username");
  const userId = getCurrentUserId(c);

  const templates = await getTemplates(username, userId);

  if (!templates) {
    return c.text("User not found.", 404);
  }

  return c.json(templates);
});

userRequiredRouter.delete("/deleteTemplate/:id", async c => {
  const userId = getCurrentUserId(c);

  if (!c.req.param("id")) {
    return c.text("Template id is required", 400);
  }

  if (!uuid.validate(c.req.param("id"))) {
    return c.text("Invalid template id", 400);
  }

  await deleteTemplate(userId, c.req.param("id"));

  return c.text("Removed");
});

userOptionalRouter.get("/checkUsernameAvailability/:username", async c => {
  const isAvailable = await checkUsernameAvailable(c.req.param("username"));

  return c.json({ isAvailable: isAvailable });
});

userRequiredRouter.get("/favoriteTemplates", async c => {
  const userId = getCurrentUserId(c);
  const templates = await getFavoriteTemplates(userId);

  return c.json(templates);
});

userRequiredRouter.post("/addFavoriteTemplate/:templateId", async c => {
  const userId = getCurrentUserId(c);

  if (!c.req.param("templateId")) {
    return c.text("Template id is required", 400);
  }

  await addTemplateFavorite(userId, c.req.param("templateId"));

  return c.text("Added");
});

userRequiredRouter.delete("/removeFavoriteTemplate/:templateId", async c => {
  const userId = getCurrentUserId(c);

  if (!c.req.param("templateId")) {
    return c.text("Template id is required", 400);
  }

  await removeTemplateFavorite(userId, c.req.param("templateId"));

  return c.text("Removed");
});

userRequiredRouter.post("/subscribeToNewsletter", async c => {
  const userId = getCurrentUserId(c);

  await subscribeToNewsletter(userId);

  return c.text("Subscribed");
});

userRouter.route("/", userOptionalRouter);
userRouter.route("/", userRequiredRouter);
