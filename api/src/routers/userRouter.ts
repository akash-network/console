import {
  saveAddressName,
  getAddressNames,
  removeAddressName,
  getSettingsOrInit,
  updateSettings,
  getUserByUsername,
  checkUsernameAvailable,
  subscribeToNewsletter
} from "@src/services/db/userDataService";
import { isValidBech32Address } from "@src/utils/addresses";
import * as uuid from "uuid";
import {
  deleteTemplate,
  getTemplateById,
  getFavoriteTemplates,
  getTemplates,
  saveTemplate,
  saveTemplateDesc,
  removeTemplateFavorite,
  addTemplateFavorite
} from "@src/services/db/templateService";
import { getBillingPortalUrl, getCheckoutUrl } from "@src/services/external/stripeService";
import { Hono } from "hono";
import { getCurrentUserId, optionalUserMiddleware, requiredUserMiddleware } from "@src/middlewares/userMiddleware";

export const userRouter = new Hono();

const userRequiredRouter = new Hono();
userRequiredRouter.use("*", requiredUserMiddleware);

const userOptionalRouter = new Hono();
userRequiredRouter.use("*", optionalUserMiddleware);

userRequiredRouter.post("/manage-subscription", async (c) => {
  const userId = getCurrentUserId(c);
  const portalUrl = await getBillingPortalUrl(userId);

  return c.redirect(portalUrl);
});

userRequiredRouter.post("/subscribe", async (c) => {
  const userId = getCurrentUserId(c);
  const { planCode, period } = await c.req.json(); // TODO Test

  if (!planCode) {
    return c.text("Missing plan code", 400);
  }
  if (!period) {
    return c.text("Missing period", 400);
  }

  const checkoutUrl = await getCheckoutUrl(userId, planCode, period === "monthly");

  return c.redirect(checkoutUrl, 303);
});

userOptionalRouter.get("/byUsername/:username", async (c) => {
  const username = c.req.param("username");

  const user = await getUserByUsername(username);

  if (!user) {
    return c.text("User not found", 404);
  }

  return c.json(user);
});

userRequiredRouter.get("/addressNames", async (c) => {
  const userId = getCurrentUserId(c);
  const addressNames = await getAddressNames(userId);

  return c.json(addressNames);
});

userRequiredRouter.post("/saveAddressName", async (c) => {
  const userId = getCurrentUserId(c);
  const { address, name } = await c.req.json();

  if (!address) {
    return c.text("Address is required", 400);
  }

  if (!name) {
    return c.text("Name is required", 400);
  }

  if (!isValidBech32Address(address, "akash")) {
    return c.text("Invalid address", 400);
  }

  await saveAddressName(userId, address, name);

  return c.text("Saved");
});

userRequiredRouter.delete("/removeAddressName/:address", async (c) => {
  const userId = getCurrentUserId(c);

  if (!c.req.param("address")) {
    return c.text("Address is required", 400);
  }

  if (!isValidBech32Address(c.req.param("address"), "akash")) {
    return c.text("Invalid address", 400);
  }

  await removeAddressName(userId, c.req.param("address"));

  return c.text("Removed");
});

userRequiredRouter.post("/tokenInfo", async (c) => {
  const userId = getCurrentUserId(c);
  const { wantedUsername, email, emailVerified, subscribedToNewsletter } = await c.req.json();

  const settings = await getSettingsOrInit(userId, wantedUsername, email, !!emailVerified, subscribedToNewsletter);

  return c.json(settings);
});

userRequiredRouter.put("/updateSettings", async (c) => {
  const userId = getCurrentUserId(c);
  const { username, subscribedToNewsletter, bio, youtubeUsername, twitterUsername, githubUsername } = await c.req.json();

  if (!/^[a-zA-Z0-9_-]*$/.test(username)) {
    return c.text("Username can only contain letters, numbers, dashes and underscores", 400);
  }

  await updateSettings(userId, username, subscribedToNewsletter, bio, youtubeUsername, twitterUsername, githubUsername);

  return c.text("Saved");
});

userOptionalRouter.get("/template/:id", async (c) => {
  const userId = getCurrentUserId(c);
  const templateId = c.req.param("id");

  if (!uuid.validate(templateId)) {
    return c.text("Invalid template id", 400);
    return;
  }

  const template = await getTemplateById(templateId, userId);

  if (!template) {
    return c.text("Template not found", 404);
  }

  return c.json(template);
});

userRequiredRouter.post("/saveTemplate", async (c) => {
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

userRequiredRouter.post("/saveTemplateDesc", async (c) => {
  const userId = getCurrentUserId(c);
  const { id, description } = await c.req.json();

  await saveTemplateDesc(id, userId, description);

  return c.text("Saved");
});

userOptionalRouter.get("/templates/:username", async (c) => {
  const username = c.req.param("username");
  const userId = getCurrentUserId(c);

  const templates = await getTemplates(username, userId);

  if (!templates) {
    return c.text("User not found.", 404);
  }

  return c.json(templates);
});

userRequiredRouter.delete("/deleteTemplate/:id", async (c) => {
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

userOptionalRouter.get("/checkUsernameAvailability/:username", async (c) => {
  const isAvailable = await checkUsernameAvailable(c.req.param("username"));

  return c.json({ isAvailable: isAvailable });
});

userRequiredRouter.get("/favoriteTemplates", async (c) => {
  const userId = getCurrentUserId(c);
  const templates = await getFavoriteTemplates(userId);

  return c.json(templates);
});

userRequiredRouter.post("/addFavoriteTemplate/:templateId", async (c) => {
  const userId = getCurrentUserId(c);

  if (!c.req.param("templateId")) {
    return c.text("Template id is required", 400);
  }

  await addTemplateFavorite(userId, c.req.param("templateId"));

  return c.text("Added");
});

userRequiredRouter.delete("/removeFavoriteTemplate/:templateId", async (c) => {
  const userId = getCurrentUserId(c);

  if (!c.req.param("templateId")) {
    return c.text("Template id is required", 400);
  }

  await removeTemplateFavorite(userId, c.req.param("templateId"));

  return c.text("Removed");
});

userRequiredRouter.post("/subscribeToNewsletter", async (c) => {
  const userId = getCurrentUserId(c);

  await subscribeToNewsletter(userId);

  return c.text("Subscribed");
});

userRouter.route("/", userOptionalRouter);
userRouter.route("/", userRequiredRouter);
