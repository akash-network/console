import { z } from "zod";

import { listOf } from "@src/components/activity/activityLabels/activityLabels";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

const NamesSchema = z.array(z.string());

/** Settings stay plain strings, so a setting the api names after this app was built drops out of the text rather than the whole change. */
const DeploymentChangesSchema = z.object({
  name: z.object({ from: z.string().nullable(), to: z.string() }).optional(),
  services: z
    .array(
      z.object({
        service: z.string(),
        image: z.string().optional(),
        addedEnv: NamesSchema.optional(),
        changedEnv: NamesSchema.optional(),
        removedEnv: NamesSchema.optional(),
        settings: NamesSchema.optional()
      })
    )
    .optional()
});

export type DeploymentChanges = z.infer<typeof DeploymentChangesSchema>;

type ServiceChanges = NonNullable<DeploymentChanges["services"]>[number];

const SETTING_LABELS = new Map([
  ["command", "the command"],
  ["args", "the arguments"],
  ["credentials", "the registry credentials"],
  ["expose", "the exposed ports"],
  ["storage", "the storage"]
]);

/** The team feed types its payload loosely, so its changes are read only when they hold the shape the api writes. */
export function readDeploymentChanges(value: unknown): DeploymentChanges | undefined {
  const parsed = DeploymentChangesSchema.safeParse(value);

  return parsed.success ? parsed.data : undefined;
}

/** Names what an update changed, one sentence per service, and undefined when it names nothing, as for an update that only replaced secret values. */
export function describeDeploymentChanges(changes: DeploymentChanges | undefined): string | undefined {
  const sentences = [...(changes?.name ? [renameSentenceOf(changes.name)] : []), ...(changes?.services ?? []).flatMap(serviceSentenceOf)];

  return sentences.length > 0 ? sentences.join(" ") : undefined;
}

export function renameTitleOf({ from, to }: NonNullable<DeploymentChanges["name"]>): string {
  return from ? `Renamed “${from}” to “${to}”` : `Named a deployment “${to}”`;
}

function renameSentenceOf({ from, to }: NonNullable<DeploymentChanges["name"]>): string {
  return from ? `Renamed from “${from}”.` : `Named “${to}”.`;
}

function serviceSentenceOf({ service, image, addedEnv = [], changedEnv = [], removedEnv = [], settings = [] }: ServiceChanges): string[] {
  const settingLabels = settings.flatMap(setting => SETTING_LABELS.get(setting) ?? []);
  const clauses = [
    ...(image ? [`set the image to ${image}`] : []),
    ...(addedEnv.length > 0 ? [`added ${listOf(addedEnv)}`] : []),
    ...(changedEnv.length > 0 ? [`changed ${listOf(changedEnv)}`] : []),
    ...(removedEnv.length > 0 ? [`removed ${listOf(removedEnv)}`] : []),
    ...(settingLabels.length > 0 ? [`changed ${listOf(settingLabels)}`] : [])
  ];

  return clauses.length > 0 ? [`${capitalizeFirstLetter(joinedClauses(clauses))} in ${service}.`] : [];
}

function joinedClauses(clauses: string[]): string {
  return clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
}
