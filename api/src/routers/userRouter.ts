import express from "express";
import { JWTRequest, optionalUserMiddleware, requiredUserMiddleware } from "@src/middlewares/userMiddleware";
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

export const userRouter = express.Router();

userRouter.post(
  "/manage-subscription",
  requiredUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const portalUrl = await getBillingPortalUrl(req.auth.sub);

    res.redirect(portalUrl);
  })
);

userRouter.post(
  "/subscribe",
  requiredUserMiddleware,
  express.urlencoded({ extended: false }),
  asyncHandler(async (req: JWTRequest, res) => {
    const { planCode, period } = req.body;

    if (!planCode) {
      res.status(400).send("Missing plan code");
      return;
    }
    if (!period) {
      res.status(400).send("Missing period");
      return;
    }

    const checkoutUrl = await getCheckoutUrl(req.auth.sub, planCode, period === "monthly");

    res.redirect(303, checkoutUrl);
  })
);

userRouter.get(
  "/byUsername/:username",
  asyncHandler(async (req, res) => {
    const username = req.params.username;

    const user = await getUserByUsername(username);

    if (!user) {
      res.status(404).send("User not found");
      return;
    }

    res.send(user);
  })
);

userRouter.get(
  "/addressNames",
  requiredUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;
    const addressNames = await getAddressNames(userId);

    res.send(addressNames);
  })
);

userRouter.post(
  "/saveAddressName",
  requiredUserMiddleware,
  express.json(),
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;
    const { address, name } = req.body;

    if (!address) {
      res.status(400).send("Address is required");
      return;
    }

    if (!name) {
      res.status(400).send("Name is required");
      return;
    }

    if (!isValidBech32Address(address, "akash")) {
      res.status(400).send("Invalid address");
      return;
    }

    await saveAddressName(userId, address, name);

    res.send("Saved");
  })
);

userRouter.delete(
  "/removeAddressName/:address",
  requiredUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;

    if (!req.params.address) {
      res.status(400).send("Address is required");
      return;
    }

    if (!isValidBech32Address(req.params.address, "akash")) {
      res.status(400).send("Invalid address");
      return;
    }

    await removeAddressName(userId, req.params.address);

    res.send("Removed");
  })
);

userRouter.post(
  "/tokenInfo",
  requiredUserMiddleware,
  express.json(),
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;
    const { wantedUsername, email, emailVerified, subscribedToNewsletter } = req.body;

    const settings = await getSettingsOrInit(userId, wantedUsername, email, !!emailVerified, subscribedToNewsletter);

    res.send(settings);
  })
);

userRouter.put(
  "/updateSettings",
  requiredUserMiddleware,
  express.json(),
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;
    const { username, subscribedToNewsletter, bio, youtubeUsername, twitterUsername, githubUsername } = req.body;

    if (!/^[a-zA-Z0-9_-]*$/.test(username)) {
      res.status(400).send("Username can only contain letters, numbers, dashes and underscores");
      return;
    }

    await updateSettings(userId, username, subscribedToNewsletter, bio, youtubeUsername, twitterUsername, githubUsername);

    res.send("Saved");
  })
);

userRouter.get(
  "/template/:id",
  optionalUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;
    const templateId = req.params.id;

    if (!uuid.validate(templateId)) {
      res.status(400).send("Invalid template id");
      return;
    }

    const template = await getTemplateById(templateId, userId);

    if (!template) {
      res.status(404).send("Template not found");
      return;
    }

    res.send(template);
  })
);

userRouter.post(
  "/saveTemplate",
  requiredUserMiddleware,
  express.json(),
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;
    const { id, sdl, isPublic, title, cpu, ram, storage } = req.body;

    if (!sdl) {
      res.status(400).send("Sdl is required");
      return;
    }

    if (!title) {
      res.status(400).send("Title is required");
      return;
    }

    const templateId = await saveTemplate(id, userId, sdl, title, cpu, ram, storage, isPublic);

    res.send(templateId);
  })
);

userRouter.post(
  "/saveTemplateDesc",
  requiredUserMiddleware,
  express.json(),
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;
    const { id, description } = req.body;

    await saveTemplateDesc(id, userId, description);

    res.send("Saved");
  })
);

userRouter.get(
  "/templates/:username",
  optionalUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const username = req.params.username;
    const userId = req.auth?.sub;

    const templates = await getTemplates(username, userId);

    if (!templates) {
      res.status(404).send("User not found.");
      return;
    }

    res.send(templates);
  })
);

userRouter.delete(
  "/deleteTemplate/:id",
  requiredUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;

    if (!req.params.id) {
      res.status(400).send("Template id is required");
      return;
    }

    if (!uuid.validate(req.params.id)) {
      res.status(400).send("Invalid template id");
      return;
    }

    await deleteTemplate(userId, req.params.id);

    res.send("Removed");
  })
);

userRouter.get(
  "/checkUsernameAvailability/:username",
  requiredUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const isAvailable = await checkUsernameAvailable(req.params.username);

    res.send({ isAvailable: isAvailable });
  })
);

userRouter.get(
  "/favoriteTemplates",
  requiredUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;
    const templates = await getFavoriteTemplates(userId);

    res.send(templates);
  })
);

userRouter.post(
  "/addFavoriteTemplate/:templateId",
  requiredUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;

    if (!req.params.templateId) {
      res.status(400).send("Template id is required");
      return;
    }

    await addTemplateFavorite(userId, req.params.templateId);

    res.send("Added");
  })
);

userRouter.delete(
  "/removeFavoriteTemplate/:templateId",
  requiredUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;

    if (!req.params.templateId) {
      res.status(400).send("Template id is required");
      return;
    }

    await removeTemplateFavorite(userId, req.params.templateId);

    res.send("Removed");
  })
);

userRouter.post(
  "/subscribeToNewsletter",
  requiredUserMiddleware,
  asyncHandler(async (req: JWTRequest, res) => {
    const userId = req.auth?.sub;

    await subscribeToNewsletter(userId);

    res.send("Subscribed");
  })
);
