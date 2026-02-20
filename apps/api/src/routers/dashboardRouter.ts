import { Hono } from "hono";
import { container } from "tsyringe";

import { privateMiddleware } from "@src/middlewares/privateMiddleware";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";

export const dashboardRouter = new Hono();

dashboardRouter.use("*", privateMiddleware);

dashboardRouter.get("/stats", async c => {
  const userRepository = container.resolve(UserRepository);
  const templateRepository = container.resolve(UserTemplateRepository);

  const [userCount, publicTemplateCount, privateTemplateCount] = await Promise.all([
    userRepository.count(),
    templateRepository.count({ isPublic: true }),
    templateRepository.count({ isPublic: false })
  ]);

  return c.json({
    userCount,
    publicTemplateCount,
    privateTemplateCount,
    totalTemplateCount: publicTemplateCount + privateTemplateCount
  });
});
