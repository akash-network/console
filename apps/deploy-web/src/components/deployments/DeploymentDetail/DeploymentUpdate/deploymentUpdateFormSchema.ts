import { z } from "zod";

import { CommandSchema, CredentialsSchema, EnvironmentVariableSchema, VALID_IMAGE_NAME } from "@src/types/sdlBuilder/sdlBuilder";

/** The patch keys a service's env by name, so a second row under one name would be folded into the first without a word. */
function refuseRepeatedVariableNames(service: { env?: Array<{ key: string }> }, context: z.RefinementCtx) {
  const seen = new Set<string>();
  (service.env ?? []).forEach((variable, envIndex) => {
    const name = variable.key.trim();
    if (seen.has(name)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["env", envIndex, "key"], message: `This service already has a variable named ${name}.` });
    }
    seen.add(name);
  });
}

const UpdatableServiceSchema = z
  .object({
    image: z.string().min(1, { message: "Docker image name is required." }).regex(VALID_IMAGE_NAME, { message: "Invalid docker image name." }),
    hasCredentials: z.boolean().optional(),
    credentials: CredentialsSchema,
    env: z.array(EnvironmentVariableSchema).optional(),
    command: CommandSchema.optional()
  })
  .passthrough()
  .superRefine(refuseRepeatedVariableNames);

/** Only what a running deployment can change is validated, because a locked field the create form would now refuse is not one the user could fix here. */
export const DeploymentUpdateFormSchema = z.object({ services: z.array(UpdatableServiceSchema) }).passthrough();
