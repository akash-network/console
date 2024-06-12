import { Template, UserSetting } from "@akashnetwork/database/dbSchemas/user";
import { Hono } from "hono";

import { privateMiddleware } from "@src/middlewares/privateMiddleware";

export const dashboardRouter = new Hono();

dashboardRouter.use("*", privateMiddleware);

dashboardRouter.get("/stats", async c => {
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
