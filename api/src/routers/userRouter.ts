import express from "express";
// import { optionalUserMiddleware, requiredUserMiddleware } from "@src/middlewares/userMiddleware";
import {
  saveAddressName,
  getAddressNames,
  removeAddressName,
  getSettingsOrInit,
  updateSettings,
  getUserByUsername,
  checkUsernameAvailable,
  subscribeToNewsletter
} from "@src/providers/userDataProvider";
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
} from "@src/db/templateProvider";
import { getBillingPortalUrl, getCheckoutUrl } from "@src/providers/stripeProvider";
import asyncHandler from "express-async-handler";
import { Context, Hono } from "hono";
import { getPayloadFromContext } from "../verify-rsa-jwt-cloudflare-worker-main";
import { requiredUserMiddleware } from "@src/middlewares/userMiddleware";

export const userRouter = new Hono();

function getCurrentUserId(c: Context) {
  const claims = getPayloadFromContext(c);
  return claims?.sub;
}

userRouter.use("*", requiredUserMiddleware);

userRouter.post("/manage-subscription", async (c) => {
  const userId = getCurrentUserId(c);
  const portalUrl = await getBillingPortalUrl(userId);

  return c.redirect(portalUrl);
});

userRouter.post("/subscribe", async (c) => {
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

// userRouter.get(
//   "/byUsername/:username",
//   asyncHandler(async (req, res) => {
//     const username = req.params.username;

//     const user = await getUserByUsername(username);

//     if (!user) {
//       res.status(404).send("User not found");
//       return;
//     }

//     res.send(user);
//   })
// );

userRouter.get("/addressNames", async (c) => {
  const userId = getCurrentUserId(c);
  const addressNames = await getAddressNames(userId);

  return c.json(addressNames);
});

userRouter.post("/saveAddressName", async (c) => {
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

userRouter.delete("/removeAddressName/:address", async (c) => {
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

userRouter.post("/tokenInfo", async (c) => {
  const userId = getCurrentUserId(c);
  const { wantedUsername, email, emailVerified, subscribedToNewsletter } = await c.req.json();

  const settings = await getSettingsOrInit(userId, wantedUsername, email, !!emailVerified, subscribedToNewsletter);

  return c.json(settings);
});

userRouter.put("/updateSettings", async (c, res) => {
  const userId = getCurrentUserId(c);
  const { username, subscribedToNewsletter, bio, youtubeUsername, twitterUsername, githubUsername } = await c.req.json();

  if (!/^[a-zA-Z0-9_-]*$/.test(username)) {
    return c.text("Username can only contain letters, numbers, dashes and underscores", 400);
  }

  await updateSettings(userId, username, subscribedToNewsletter, bio, youtubeUsername, twitterUsername, githubUsername);

  return c.text("Saved");
});

// userRouter.get(
//   "/template/:id",
//   optionalUserMiddleware,
//   asyncHandler(async (req: JWTRequest, res) => {
//     const userId = req.auth?.sub;
//     const templateId = req.params.id;

//     if (!uuid.validate(templateId)) {
//       res.status(400).send("Invalid template id");
//       return;
//     }

//     const template = await getTemplateById(templateId, userId);

//     if (!template) {
//       res.status(404).send("Template not found");
//       return;
//     }

//     res.send(template);
//   })
// );

userRouter.post("/saveTemplate", async (c) => {
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

userRouter.post("/saveTemplateDesc", async (c) => {
  const userId = getCurrentUserId(c);
  const { id, description } = await c.req.json();

  await saveTemplateDesc(id, userId, description);

  return c.text("Saved");
});

// userRouter.get(
//   "/templates/:username",
//   optionalUserMiddleware,
//   asyncHandler(async (req: JWTRequest, res) => {
//     const username = req.params.username;
//     const userId = req.auth?.sub;

//     const templates = await getTemplates(username, userId);

//     if (!templates) {
//       res.status(404).send("User not found.");
//       return;
//     }

//     res.send(templates);
//   })
// );

userRouter.delete("/deleteTemplate/:id", async (c) => {
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

// userRouter.get("/checkUsernameAvailability/:username", async (c) => {
//   const isAvailable = await checkUsernameAvailable(c.req.param("username"));

//   return c.json({ isAvailable: isAvailable });
// });

userRouter.get("/favoriteTemplates", async (c) => {
  const userId = getCurrentUserId(c);
  const templates = await getFavoriteTemplates(userId);

  return c.json(templates);
});

userRouter.post("/addFavoriteTemplate/:templateId", async (c) => {
  const userId = getCurrentUserId(c);

  if (!c.req.param("templateId")) {
    return c.text("Template id is required", 400);
  }

  await addTemplateFavorite(userId, c.req.param("templateId"));

  return c.text("Added");
});

userRouter.delete("/removeFavoriteTemplate/:templateId", async (c) => {
  const userId = getCurrentUserId(c);

  if (!c.req.param("templateId")) {
    return c.text("Template id is required", 400);
  }

  await removeTemplateFavorite(userId, c.req.param("templateId"));

  return c.text("Removed");
});

userRouter.post("/subscribeToNewsletter", async (c) => {
  const userId = getCurrentUserId(c);

  await subscribeToNewsletter(userId);

  return c.text("Subscribed");
});
