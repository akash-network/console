import { z } from "zod";

import { CommandSchema, CredentialsSchema, EnvironmentVariableSchema, VALID_IMAGE_NAME } from "@src/types/sdlBuilder/sdlBuilder";

interface EnvRowRef {
  envIndex: number;
  isSecret: boolean;
}

/** The patch keys a service's env by name, so a second row under one name would be folded into the first without a word. */
function refuseRepeatedVariableNames(service: { env?: Array<{ key: string; isSecret?: boolean }> }, context: z.RefinementCtx) {
  const rowsByName = new Map<string, EnvRowRef[]>();
  (service.env ?? []).forEach((variable, envIndex) => {
    const name = variable.key.trim();
    rowsByName.set(name, [...(rowsByName.get(name) ?? []), { envIndex, isSecret: !!variable.isSecret }]);
  });

  rowsByName.forEach((rows, name) => {
    const keeper = rowThatKeepsTheName(rows);
    rows
      .filter(row => row !== keeper)
      .forEach(row =>
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["env", row.envIndex, "key"],
          message: `This service already has a ${keeper.isSecret ? "secret" : "variable"} named ${name}.`
        })
      );
  });
}

/** A secret's row can neither be renamed nor show an error here, so the clash has to land on a variable the user can change. */
function rowThatKeepsTheName(rows: EnvRowRef[]): EnvRowRef {
  return rows.find(row => row.isSecret) ?? rows[0];
}

/** The password is always kept from the stored copy here, so a length the create form asks for is not one the user could meet. */
const KeptCredentialsSchema = CredentialsSchema.unwrap().extend({ password: z.string().optional() }).optional();

const UpdatableServiceSchema = z
  .object({
    image: z.string().min(1, { message: "Docker image name is required." }).regex(VALID_IMAGE_NAME, { message: "Invalid docker image name." }),
    hasCredentials: z.boolean().optional(),
    credentials: KeptCredentialsSchema,
    env: z.array(EnvironmentVariableSchema).optional(),
    command: CommandSchema.optional()
  })
  .passthrough()
  .superRefine(refuseRepeatedVariableNames);

/** Only what a running deployment can change is validated, because a locked field the create form would now refuse is not one the user could fix here. */
export const DeploymentUpdateFormSchema = z.object({ services: z.array(UpdatableServiceSchema) }).passthrough();
