import { Template, UserSetting } from "@shared/dbSchemas/user";
import { privateMiddleware } from "@src/middlewares/privateMiddleware";
import express from "express";
import asyncHandler from "express-async-handler";

export const dashboardRouter = express.Router();

dashboardRouter.use(privateMiddleware);

dashboardRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const userCountRequest = UserSetting.count({ where: { accountType: "cloudmos" } });
    const publicTemplateCountRequest = Template.count({
      where: { isPublic: true }
    });
    const privateTemplateCountRequest = Template.count({
      where: { isPublic: false }
    });

    const [userCount, publicTemplateCount, privateTemplateCount] = await Promise.all([
      userCountRequest,
      publicTemplateCountRequest,
      privateTemplateCountRequest
    ]);

    res.send({
      userCount,
      publicTemplateCount,
      privateTemplateCount,
      totalTemplateCount: publicTemplateCount + privateTemplateCount
    });
  })
);
