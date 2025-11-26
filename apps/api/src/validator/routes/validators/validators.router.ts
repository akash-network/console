import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ValidatorController } from "@src/validator/controllers/validator/validator.controller";
import {
  GetValidatorByAddressParamsSchema,
  GetValidatorByAddressResponseSchema,
  GetValidatorListResponseSchema
} from "@src/validator/http-schemas/validator.schema";

export const validatorsRouter = new OpenApiHonoHandler();

const getValidatorListRoute = createRoute({
  method: "get",
  path: "/v1/validators",
  tags: ["Validators"],
  security: SECURITY_NONE,
  responses: {
    200: {
      description: "Returns validators",
      content: {
        "application/json": {
          schema: GetValidatorListResponseSchema
        }
      }
    }
  }
});
validatorsRouter.openapi(getValidatorListRoute, async function routeGetValidatorList(c) {
  const validators = await container.resolve(ValidatorController).getValidatorList();

  return c.json(validators);
});

const getValidatorByAddressRoute = createRoute({
  method: "get",
  path: "/v1/validators/{address}",
  tags: ["Validators"],
  security: SECURITY_NONE,
  request: {
    params: GetValidatorByAddressParamsSchema
  },
  responses: {
    200: {
      description: "Return a validator information",
      content: {
        "application/json": {
          schema: GetValidatorByAddressResponseSchema
        }
      }
    },
    400: {
      description: "Invalid address"
    },
    404: {
      description: "Validator not found"
    }
  }
});
validatorsRouter.openapi(getValidatorByAddressRoute, async function routeGetValidatorByAddress(c) {
  const { address } = c.req.valid("param");
  const validator = await container.resolve(ValidatorController).getValidatorByAddress(address);
  if (!validator) {
    return c.text("Validator not found", 404);
  }

  return c.json(validator);
});
