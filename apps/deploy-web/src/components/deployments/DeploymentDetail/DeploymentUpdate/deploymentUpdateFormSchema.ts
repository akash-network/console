import { z } from "zod";

import type { SdlBuilderFormValuesType } from "@src/types";
import { CommandSchema, CredentialsSchema, EnvironmentVariableSchema, VALID_IMAGE_NAME } from "@src/types/sdlBuilder/sdlBuilder";
import { secretNameOf } from "@src/utils/sdl/sdlSecrets";

/** A replacement typed for a kept secret is keyed by the name its reference carries, so the reference itself never changes under it. */
export type DeploymentUpdateFormValues = SdlBuilderFormValuesType & { secretValues?: Record<string, string | undefined> };

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

/** A kept secret's value is its reference, so only a secret added here can be left without one. */
function refuseSecretsWithoutValue(service: { env?: Array<{ value?: string; isSecret?: boolean }> }, context: z.RefinementCtx) {
  (service.env ?? []).forEach((variable, envIndex) => {
    if (variable.isSecret && !variable.value) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["env", envIndex, "value"], message: "Enter a value for this secret." });
    }
  });
}

const RegistryPasswordSchema = CredentialsSchema.unwrap().shape.password;

/** A kept password stands as its reference, so the create form's rule has to be held against the replacement typed for it instead. */
function refuseShortRegistryPasswordReplacements(
  values: Pick<DeploymentUpdateFormValues, "secretValues"> & { services: Array<{ hasCredentials?: boolean; credentials?: { password: string } }> },
  context: z.RefinementCtx
) {
  values.services.forEach(service => {
    const name = service.hasCredentials ? secretNameOf(service.credentials?.password ?? "") : null;
    const replacement = name ? values.secretValues?.[name] : undefined;
    if (!name || !replacement) return;

    RegistryPasswordSchema.safeParse(replacement).error?.issues.forEach(issue => context.addIssue({ ...issue, path: ["secretValues", name] }));
  });
}

/** A kept registry stands as references long enough to pass the create form's rules, so they hold for a registry added here too. */
const UpdatableCredentialsSchema = CredentialsSchema.unwrap()
  .extend({ username: z.string().min(1, { message: "Username is required." }) })
  .optional();

const UpdatableServiceSchema = z
  .object({
    image: z.string().min(1, { message: "Docker image name is required." }).regex(VALID_IMAGE_NAME, { message: "Invalid docker image name." }),
    hasCredentials: z.boolean().optional(),
    credentials: UpdatableCredentialsSchema,
    env: z.array(EnvironmentVariableSchema).optional(),
    command: CommandSchema.optional()
  })
  .passthrough()
  .superRefine(refuseRepeatedVariableNames)
  .superRefine(refuseSecretsWithoutValue);

/** Only what a running deployment can change is validated, because a locked field the create form would now refuse is not one the user could fix here. */
export const DeploymentUpdateFormSchema = z
  .object({ services: z.array(UpdatableServiceSchema), secretValues: z.record(z.string().optional()).optional() })
  .passthrough()
  .superRefine(refuseShortRegistryPasswordReplacements);
