import { z } from "zod";

import type { ExposeType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { CommandSchema, CredentialsSchema, EnvironmentVariableSchema, ExposeSchema, VALID_IMAGE_NAME } from "@src/types/sdlBuilder/sdlBuilder";
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

const UpdatablePortSchema = z.number({ invalid_type_error: "Enter a port number." }).pipe(ExposeSchema.shape.port);

const UpdatableServiceSchema = z
  .object({
    image: z.string().min(1, { message: "Docker image name is required." }).regex(VALID_IMAGE_NAME, { message: "Invalid docker image name." }),
    hasCredentials: z.boolean().optional(),
    credentials: UpdatableCredentialsSchema,
    env: z.array(EnvironmentVariableSchema).optional(),
    command: CommandSchema.optional(),
    expose: z.array(z.object({ port: UpdatablePortSchema, as: UpdatablePortSchema, global: z.boolean().optional() }).passthrough())
  })
  .passthrough()
  .superRefine(refuseRepeatedVariableNames)
  .superRefine(refuseSecretsWithoutValue);

/** Only what a running deployment can change is validated, because a locked field the create form would now refuse is not one the user could fix here. */
export const DeploymentUpdateFormSchema = z
  .object({ services: z.array(UpdatableServiceSchema), secretValues: z.record(z.string().optional()).optional() })
  .passthrough()
  .superRefine(refuseShortRegistryPasswordReplacements);

const SHARED_HTTP_PORT = 80;

type ExposedPort = Pick<ExposeType, "port" | "as" | "global">;

/** The chain fixed each endpoint's kind at create, so a port move is judged against the ports the form was loaded with, as the api judges it. */
export function deploymentUpdateFormSchemaFor(loadedServices: ServiceType[]) {
  return DeploymentUpdateFormSchema.superRefine((values, context) =>
    values.services.forEach((service, serviceIndex) =>
      refusePortMovesTheApiRefuses(service.expose, loadedServices[serviceIndex]?.expose ?? [], ["services", serviceIndex, "expose"], context)
    )
  );
}

function refusePortMovesTheApiRefuses(expose: ExposedPort[], loaded: ExposedPort[], path: Array<string | number>, context: z.RefinementCtx) {
  expose.forEach((entry, exposeIndex) => {
    const before = loaded[exposeIndex];
    if (!before) return;

    const others = expose.filter(other => other !== entry);
    const addIssue = (field: "port" | "as", message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, exposeIndex, field], message });

    if (changesEndpointKind(before, entry)) addIssue("as", endpointKindMessageOf(before));
    if (entry.port !== before.port && others.some(other => other.port === entry.port)) addIssue("port", `This service already exposes port ${entry.port}.`);
    if (entry.as !== before.as && others.some(other => other.as === entry.as)) addIssue("as", `Another port of this service is already exposed as ${entry.as}.`);
  });
}

/** Mirrors chain-sdk's `isIngress`: a public endpoint on external port 80 is shared HTTP and any other is a random port, and an update cannot turn one into the other. */
function changesEndpointKind(before: ExposedPort, after: ExposedPort): boolean {
  return !!before.global && (before.as === SHARED_HTTP_PORT) !== (after.as === SHARED_HTTP_PORT);
}

function endpointKindMessageOf(before: ExposedPort): string {
  return before.as === SHARED_HTTP_PORT
    ? "Port 80 is served over HTTP with a hostname, so moving it off 80 needs a new deployment."
    : "This endpoint is reached on a random public port, so moving it onto 80 needs a new deployment.";
}
