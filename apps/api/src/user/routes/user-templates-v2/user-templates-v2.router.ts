import { container } from "tsyringe";
import { z } from "zod";

import { AuthService } from "@src/auth/services/auth.service";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { UserTemplatesController } from "@src/user/controllers/user-templates/user-templates.controller";

export const userTemplatesRouterV2 = new OpenApiHonoHandler();

// GET /template/:id - optional auth
const getTemplateByIdRoute = createRoute({
  method: "get",
  path: "/user/template/{id}",
  summary: "Get template by ID",
  tags: ["Users"],
  security: SECURITY_NONE,
  request: {
    params: z.object({
      id: z.string()
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

userTemplatesRouterV2.openapi(getTemplateByIdRoute, async function getTemplateById(c) {
  const { id } = c.req.valid("param");
  const authService = container.resolve(AuthService);
  const userId = authService.currentUser?.userId || "";
  const template = await container.resolve(UserTemplatesController).getTemplateById(id, userId);
  return c.json(template, 200);
});

// POST /saveTemplate - requires auth
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
            id: z.string(),
            sdl: z.string(),
            isPublic: z.boolean(),
            title: z.string(),
            cpu: z.number(),
            ram: z.number(),
            storage: z.number()
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

userTemplatesRouterV2.openapi(saveTemplateRoute, async function saveTemplate(c) {
  const data = c.req.valid("json");
  const templateId = await container.resolve(UserTemplatesController).saveTemplate(data);
  return c.text(templateId, 200);
});

// POST /saveTemplateDesc - requires auth
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
            id: z.string(),
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

userTemplatesRouterV2.openapi(saveTemplateDescRoute, async function saveTemplateDesc(c) {
  const data = c.req.valid("json");
  await container.resolve(UserTemplatesController).saveTemplateDesc(data);
  return c.text("Saved", 200);
});

// GET /templates/:username - optional auth
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

userTemplatesRouterV2.openapi(getTemplatesRoute, async function getTemplates(c) {
  const { username } = c.req.valid("param");
  const authService = container.resolve(AuthService);
  const userId = authService.currentUser?.userId || "";
  const templates = await container.resolve(UserTemplatesController).getTemplates(username, userId);
  return c.json(templates, 200);
});

// DELETE /deleteTemplate/:id - requires auth
const deleteTemplateRoute = createRoute({
  method: "delete",
  path: "/user/deleteTemplate/{id}",
  summary: "Delete template",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: z.object({
      id: z.string()
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

userTemplatesRouterV2.openapi(deleteTemplateRoute, async function deleteTemplate(c) {
  const { id } = c.req.valid("param");
  await container.resolve(UserTemplatesController).deleteTemplate(id);
  return c.text("Removed", 200);
});

// GET /favoriteTemplates - requires auth
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

userTemplatesRouterV2.openapi(getFavoriteTemplatesRoute, async function getFavoriteTemplates(c) {
  const templates = await container.resolve(UserTemplatesController).getFavoriteTemplates();
  return c.json(templates, 200);
});

// POST /addFavoriteTemplate/:templateId - requires auth
const addFavoriteTemplateRoute = createRoute({
  method: "post",
  path: "/user/addFavoriteTemplate/{templateId}",
  summary: "Add favorite template",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: z.object({
      templateId: z.string()
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

userTemplatesRouterV2.openapi(addFavoriteTemplateRoute, async function addFavoriteTemplate(c) {
  const { templateId } = c.req.valid("param");
  await container.resolve(UserTemplatesController).addFavoriteTemplate(templateId);
  return c.text("Added", 200);
});

// DELETE /removeFavoriteTemplate/:templateId - requires auth
const removeFavoriteTemplateRoute = createRoute({
  method: "delete",
  path: "/user/removeFavoriteTemplate/{templateId}",
  summary: "Remove favorite template",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: z.object({
      templateId: z.string()
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

userTemplatesRouterV2.openapi(removeFavoriteTemplateRoute, async function removeFavoriteTemplate(c) {
  const { templateId } = c.req.valid("param");
  await container.resolve(UserTemplatesController).removeFavoriteTemplate(templateId);
  return c.text("Removed", 200);
});
