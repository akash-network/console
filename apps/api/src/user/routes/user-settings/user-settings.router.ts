import { Hono } from "hono";
import { container } from "tsyringe";

import { getCurrentUserId, optionalUserMiddleware, requiredUserMiddleware } from "@src/middlewares/userMiddleware";
import { UserController } from "@src/user/controllers/user/user.controller";

export const userSettingsRouter = new Hono();

const userRequiredRouter = new Hono();
userRequiredRouter.use("*", requiredUserMiddleware);

const userOptionalRouter = new Hono();
userOptionalRouter.use("*", optionalUserMiddleware);

userOptionalRouter.get("/byUsername/:username", async c => {
  const username = c.req.param("username");

  try {
    const user = await container.resolve(UserController).getUserByUsername(username);
    return c.json(user);
  } catch (error: any) {
    return c.text(error.message || "User not found", 404);
  }
});

userRequiredRouter.put("/updateSettings", async c => {
  const userId = getCurrentUserId(c);
  const data = await c.req.json();

  try {
    await container.resolve(UserController).updateSettings(userId, data);
    return c.text("Saved");
  } catch (error: any) {
    return c.text(error.message || "Error updating settings", 400);
  }
});

userOptionalRouter.get("/checkUsernameAvailability/:username", async c => {
  const username = c.req.param("username");
  const result = await container.resolve(UserController).checkUsernameAvailable(username);
  return c.json(result);
});

userRequiredRouter.post("/subscribeToNewsletter", async c => {
  const userId = getCurrentUserId(c);
  await container.resolve(UserController).subscribeToNewsletter(userId);
  return c.text("Subscribed");
});

userSettingsRouter.route("/", userOptionalRouter);
userSettingsRouter.route("/", userRequiredRouter);
