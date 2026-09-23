import { z } from "zod";

import { CommandSchema, CredentialsSchema, EnvironmentVariableSchema, VALID_IMAGE_NAME } from "@src/types/sdlBuilder/sdlBuilder";

const UpdatableServiceSchema = z
  .object({
    image: z.string().min(1, { message: "Docker image name is required." }).regex(VALID_IMAGE_NAME, { message: "Invalid docker image name." }),
    hasCredentials: z.boolean().optional(),
    credentials: CredentialsSchema,
    env: z.array(EnvironmentVariableSchema).optional(),
    command: CommandSchema.optional()
  })
  .passthrough();

/** Only what a running deployment can change is validated, because a locked field the create form would now refuse is not one the user could fix here. */
export const DeploymentUpdateFormSchema = z.object({ services: z.array(UpdatableServiceSchema) }).passthrough();
