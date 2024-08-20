import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { UserController } from "@src/user/controllers/user/user.controller";

const UserCreateRequestInputSchema = z.object({
  data: z.object({
    userId: z.string(),
    wantedUsername: z.string(),
    email: z.string().email(),
    emailVerified: z.boolean(),
    subscribedToNewsletter: z.boolean()
  })
});
const UserResponseOutputSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    userId: z.string(),
    username: z.string(),
    email: z.string().email(),
    emailVerified: z.boolean(),
    bio: z.string(),
    subscribedToNewsletter: z.boolean(),
    youtubeUsername: z.string(),
    twitterUsername: z.string(),
    githubUsername: z.string()
  })
});

export type UserCreateRequestInput = z.infer<typeof UserCreateRequestInputSchema>;
export type UserResponseOutput = z.infer<typeof UserResponseOutputSchema>;

const route = createRoute({
  method: "post",
  path: "/v1/users",
  summary: "Creates an anonymous user",
  tags: ["Users"],
  request: {
    body: {
      description: "",
      content: {
        "application/json": {
          schema: UserCreateRequestInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a created anonymous user",
      body: {
        content: {
          "application/json": {
            schema: UserResponseOutputSchema
          }
        }
      }
    }
  }
});
export const createOrGetUserRouter = new OpenAPIHono();

createOrGetUserRouter.openapi(route, async function routeCreateUser(c) {
  return c.json(await container.resolve(UserController).createOrGet(c.req.valid("json")), 200);
});
