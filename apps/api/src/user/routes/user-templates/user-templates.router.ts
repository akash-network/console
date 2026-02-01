import { container } from "tsyringe";
import { z } from "zod";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { UserTemplatesController } from "@src/user/controllers/user-templates/user-templates.controller";

export const userTemplatesRouter = new OpenApiHonoHandler();

const getTemplateByIdRoute = createRoute({
  method: "get",
  path: "/user/template/{id}",
  summary: "Get template by ID",
  tags: ["Users"],
  security: SECURITY_NONE,
  request: {
    params: z.object({
      id: z.string().uuid()
    })
  },
  responses: {
    200: {
      description: "Returns template"
    },
    400: {
      description: "Invalid template ID"
    },
    404: {
      description: "Template not found"
    }
  }
});

userTemplatesRouter.openapi(getTemplateByIdRoute, async function getTemplateById(c) {
  const { id } = c.req.valid("param");
  const template = await container.resolve(UserTemplatesController).getTemplateById(id);
  return c.json(template, 200);
});

const saveTemplateRoute = createRoute({
  method: "post",
  path: "/user/saveTemplate",
  summary: "Save template",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            id: z.string().uuid().optional(),
            sdl: z.string(),
            title: z.string(),
            cpu: z.number(),
            ram: z.number(),
            storage: z.number(),
            isPublic: z.boolean(),
            description: z.string().max(2000).optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Template saved successfully"
    },
    400: {
      description: "Invalid input"
    },
    401: {
      description: "Unauthorized"
    }
  }
});

userTemplatesRouter.openapi(saveTemplateRoute, async function saveTemplate(c) {
  const data = c.req.valid("json");
  const templateId = await container.resolve(UserTemplatesController).saveTemplate(data);
  return c.text(templateId, 200);
});

const saveTemplateDescRoute = createRoute({
  method: "post",
  path: "/user/saveTemplateDesc",
  summary: "Save template description",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            id: z.string().uuid(),
            description: z.string()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Template description saved successfully"
    },
    401: {
      description: "Unauthorized"
    }
  }
});

userTemplatesRouter.openapi(saveTemplateDescRoute, async function saveTemplateDesc(c) {
  const data = c.req.valid("json");
  await container.resolve(UserTemplatesController).updateTemplate(data);
  return c.body(null, 204);
});

const getTemplatesRoute = createRoute({
  method: "get",
  path: "/user/templates/{username}",
  summary: "Get templates by username",
  tags: ["Users"],
  security: SECURITY_NONE,
  request: {
    params: z.object({
      username: z.string()
    })
  },
  responses: {
    200: {
      description: "Returns templates"
    },
    404: {
      description: "User not found"
    }
  }
});

userTemplatesRouter.openapi(getTemplatesRoute, async function getTemplates(c) {
  const { username } = c.req.valid("param");
  const templates = await container.resolve(UserTemplatesController).getTemplates(username);
  return c.json(templates, 200);
});

const deleteTemplateRoute = createRoute({
  method: "delete",
  path: "/user/deleteTemplate/{id}",
  summary: "Delete template",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: z.object({
      id: z.string().uuid()
    })
  },
  responses: {
    200: {
      description: "Template deleted successfully"
    },
    400: {
      description: "Invalid template ID"
    },
    401: {
      description: "Unauthorized"
    }
  }
});

userTemplatesRouter.openapi(deleteTemplateRoute, async function deleteTemplate(c) {
  const { id } = c.req.valid("param");
  await container.resolve(UserTemplatesController).deleteTemplate(id);
  return c.body(null, 204);
});

const getFavoriteTemplatesRoute = createRoute({
  method: "get",
  path: "/user/favoriteTemplates",
  summary: "Get favorite templates",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: {
    200: {
      description: "Returns favorite templates"
    },
    401: {
      description: "Unauthorized"
    }
  }
});

userTemplatesRouter.openapi(getFavoriteTemplatesRoute, async function getFavoriteTemplates(c) {
  const templates = await container.resolve(UserTemplatesController).getFavoriteTemplates();
  return c.json(templates, 200);
});

const addFavoriteTemplateRoute = createRoute({
  method: "post",
  path: "/user/addFavoriteTemplate/{templateId}",
  summary: "Add favorite template",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: z.object({
      templateId: z.string().uuid()
    })
  },
  responses: {
    200: {
      description: "Template added to favorites"
    },
    400: {
      description: "Invalid template ID"
    },
    401: {
      description: "Unauthorized"
    }
  }
});

userTemplatesRouter.openapi(addFavoriteTemplateRoute, async function addFavoriteTemplate(c) {
  const { templateId } = c.req.valid("param");
  await container.resolve(UserTemplatesController).addFavoriteTemplate(templateId);
  return c.body(null, 204);
});

const removeFavoriteTemplateRoute = createRoute({
  method: "delete",
  path: "/user/removeFavoriteTemplate/{templateId}",
  summary: "Remove favorite template",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: z.object({
      templateId: z.string().uuid()
    })
  },
  responses: {
    200: {
      description: "Template removed from favorites"
    },
    400: {
      description: "Invalid template ID"
    },
    401: {
      description: "Unauthorized"
    }
  }
});

userTemplatesRouter.openapi(removeFavoriteTemplateRoute, async function removeFavoriteTemplate(c) {
  const { templateId } = c.req.valid("param");
  await container.resolve(UserTemplatesController).removeFavoriteTemplate(templateId);
  return c.body(null, 204);
});
