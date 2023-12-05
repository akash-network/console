import { z } from "@hono/zod-openapi";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

const ParamsSchema = z.object({
  id: z
    .string()
    .min(3)
    .openapi({
      param: {
        name: "id",
        in: "path"
      },
      example: "1212121"
    })
});

const UserSchema = z
  .object({
    id: z.string().openapi({
      example: "123"
    }),
    name: z.string().openapi({
      example: "John Doe"
    }),
    age: z.number().openapi({
      example: 42
    })
  })
  .openapi("User");

const route = createRoute({
  method: "get",
  path: "/users/{id}",
  request: {
    params: ParamsSchema
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: UserSchema
        }
      },
      description: "Retrieve the user"
    }
  }
});
const app = new OpenAPIHono();

app.openapi(route, (c) => {
  const { id } = c.req.valid("param");
  return c.jsonT({
    id,
    age: 20,
    name: "Ultra-man"
  });
});

// The OpenAPI documentation will be available at /doc
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "My API"
  }
});
