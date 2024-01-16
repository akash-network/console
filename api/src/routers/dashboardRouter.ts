import { Template, UserSetting } from "@shared/dbSchemas/user";
import { privateMiddleware } from "@src/middlewares/privateMiddleware";
import asyncHandler from "express-async-handler"; // TODO: Uninstall
import { Hono } from "hono";

export const dashboardRouter = new Hono();

dashboardRouter.use("*", privateMiddleware);

dashboardRouter.get("/stats", async (c) => {
  const userCountRequest = UserSetting.count();
  const publicTemplateCountRequest = Template.count({
    where: { isPublic: true }
  });
  const privateTemplateCountRequest = Template.count({
    where: { isPublic: false }
  });

  const [userCount, publicTemplateCount, privateTemplateCount] = await Promise.all([userCountRequest, publicTemplateCountRequest, privateTemplateCountRequest]);

  return c.json({
    userCount,
    publicTemplateCount,
    privateTemplateCount,
    totalTemplateCount: publicTemplateCount + privateTemplateCount
  });
});
