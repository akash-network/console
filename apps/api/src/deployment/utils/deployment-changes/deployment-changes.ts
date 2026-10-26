import type { SDLInput } from "@akashnetwork/chain-sdk";
import { isDeepStrictEqual } from "node:util";

import { DEPLOYMENT_SERVICE_SETTINGS, type DeploymentChanges, type DeploymentServiceChanges, type DeploymentServiceSetting } from "@src/activity/model-schemas";
import { ownValue, readEnvDeclaration } from "@src/deployment/services/sdl-reference/sdl-reference.service";

type SdlServices = SDLInput["services"];

type SdlService = SdlServices[string];

type ServicesChange = { before: SdlServices; after: SdlServices; patched: string[] };

type NameChange = { from: string | null; to: string | undefined };

type EnvChanges = Pick<DeploymentServiceChanges, "addedEnv" | "changedEnv" | "removedEnv">;

/** `after` is read before secrets are derived from it, or a value written unchanged would read as changed once it stands as a new reference. */
export function deploymentChangesOf({ name, services }: { name: NameChange; services: ServicesChange }): DeploymentChanges | undefined {
  const renamed = name.to !== undefined && name.to !== name.from ? { from: name.from, to: name.to } : undefined;
  const changedServices = services.patched.flatMap(service => {
    const changes = serviceChangesOf(service, ownValue(services.before, service), ownValue(services.after, service));
    return changes ? [changes] : [];
  });

  if (!renamed && changedServices.length === 0) return undefined;

  return { ...(renamed ? { name: renamed } : {}), ...(changedServices.length > 0 ? { services: changedServices } : {}) };
}

function serviceChangesOf(service: string, before: SdlService | undefined, after: SdlService | undefined): DeploymentServiceChanges | undefined {
  const image = after?.image !== before?.image ? after?.image : undefined;
  const settings = DEPLOYMENT_SERVICE_SETTINGS.filter(setting => !isDeepStrictEqual(settingOf(before, setting), settingOf(after, setting)));
  const changes: DeploymentServiceChanges = {
    service,
    ...(image ? { image } : {}),
    ...envChangesOf(envOf(before), envOf(after)),
    ...(settings.length > 0 ? { settings } : {})
  };

  return Object.keys(changes).length > 1 ? changes : undefined;
}

function settingOf(service: SdlService | undefined, setting: DeploymentServiceSetting): unknown {
  return setting === "storage" ? service?.params?.storage : service?.[setting];
}

/** Keyed by name, because a patched variable moves to the end of the list and a move alone changes nothing. */
function envOf(service: SdlService | undefined): Map<string, string> {
  const entries = Array.isArray(service?.env) ? service.env.filter(entry => typeof entry === "string") : [];

  return new Map(entries.map(entry => [readEnvDeclaration(entry)?.key ?? entry, entry]));
}

function envChangesOf(before: Map<string, string>, after: Map<string, string>): EnvChanges {
  const addedEnv = [...after.keys()].filter(key => !before.has(key));
  const changedEnv = [...after.keys()].filter(key => before.has(key) && before.get(key) !== after.get(key));
  const removedEnv = [...before.keys()].filter(key => !after.has(key));

  return {
    ...(addedEnv.length > 0 ? { addedEnv } : {}),
    ...(changedEnv.length > 0 ? { changedEnv } : {}),
    ...(removedEnv.length > 0 ? { removedEnv } : {})
  };
}
