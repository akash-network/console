import type { ServiceType } from "@src/types";
import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { RESERVED_ENV_KEYS } from "@src/types/sdlBuilder/sdlBuilder";
import { guessAskedValue, labelFromKey, looksLikeSecret } from "./askedValueDefaults";

const ASKED_VALUE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const MAX_ASKED_VALUES = 50;
const MAX_BINDINGS = 20;
const MAX_CHOICES = 50;
const MAX_CHOICE_LENGTH = 200;
const MAX_DEFAULT_LENGTH = 4096;
const MAX_LABEL_LENGTH = 80;
const MAX_HELP_LENGTH = 500;

type AskedValueType = TemplateAskedValue["type"];

export type AskedValueSetting = {
  key: string;
  isAsked: boolean;
  customized: Partial<Pick<TemplateAskedValue, "label" | "help" | "type" | "required">> & {
    choices?: string[];
    min?: number;
    max?: number;
    integer?: boolean;
    minLength?: number;
    maxLength?: number;
  };
};

type Customization = AskedValueSetting["customized"];

export type UnaskableSecret = { service: string; key: string };

type EnvRow = { service: string; key: string; value: string; isSecret: boolean };

type EnvGroup = { key: string; isSecret: boolean; firstValue: string; bindings: Array<{ service: string; env: string }> };

export function buildAskedValues(services: ServiceType[], settings: Record<string, AskedValueSetting>): TemplateAskedValue[] {
  const askedValues: TemplateAskedValue[] = [];

  for (const group of groupByKey(services)) {
    const setting = settings[group.key];
    if (!group.isSecret && !setting?.isAsked) continue;

    askedValues.push(buildAskedValue(group, setting?.customized ?? {}));
  }

  return capKeepingSecrets(askedValues);
}

export function isAskableKey(key: string): boolean {
  return ASKED_VALUE_KEY_PATTERN.test(key);
}

function capKeepingSecrets(askedValues: TemplateAskedValue[]): TemplateAskedValue[] {
  const secrets = askedValues.filter(value => value.type === "secret");
  const plain = askedValues.filter(value => value.type !== "secret");
  const kept = new Set([...secrets, ...plain].slice(0, MAX_ASKED_VALUES));
  return askedValues.filter(value => kept.has(value));
}

export function summarizeAskedValues(
  values: TemplateAskedValue[],
  services: ServiceType[]
): { asked: number; secrets: number; needsAttention: number; lookalikeKeys: string[]; savedAsIs: string[]; unaskableSecrets: UnaskableSecret[] } {
  const askedKeys = new Set(values.map(value => value.key));
  const secretKeys = secretKeysOf(values);
  const rows = listEnvRows(services);
  const plainRows = rows.filter(row => !row.isSecret);
  const unaskedKeys = plainRows.map(row => row.key).filter(key => !askedKeys.has(key));
  const lookalikeRows = plainRows.filter(row => !secretKeys.has(row.key) && looksLikeSecret(row.key, row.value));

  return {
    asked: values.length,
    secrets: values.filter(value => value.type === "secret").length,
    needsAttention: lookalikeRows.length,
    lookalikeKeys: [...new Set(lookalikeRows.map(row => row.key))],
    savedAsIs: [...new Set(unaskedKeys)],
    unaskableSecrets: rows.filter(row => row.isSecret && !isAskableKey(row.key)).map(({ service, key }) => ({ service, key }))
  };
}

/** A key asked as a secret is asked as one in every service, so its plain rows are sealed too rather than sent in the clear. */
export function sealSharedSecretKeys(services: ServiceType[], askedValues: TemplateAskedValue[]): ServiceType[] {
  const secretKeys = secretKeysOf(askedValues);

  return services.map(service => ({
    ...service,
    env: service.env?.map(variable => (secretKeys.has(variable.key.trim()) ? { ...variable, isSecret: true } : variable))
  }));
}

function secretKeysOf(askedValues: TemplateAskedValue[]): Set<string> {
  return new Set(askedValues.filter(value => value.type === "secret").map(value => value.key));
}

function listEnvRows(services: ServiceType[]): EnvRow[] {
  const reservedKeys: readonly string[] = RESERVED_ENV_KEYS;

  return services
    .filter(service => service.title !== "")
    .flatMap(service =>
      (service.env ?? []).flatMap(variable => {
        const key = variable.key.trim();
        return key === "" || reservedKeys.includes(key) ? [] : [{ service: service.title, key, value: variable.value ?? "", isSecret: !!variable.isSecret }];
      })
    );
}

function groupByKey(services: ServiceType[]): EnvGroup[] {
  const groups = new Map<string, EnvGroup>();

  for (const row of listEnvRows(services)) {
    if (!isAskableKey(row.key)) continue;

    const group = groups.get(row.key) ?? { key: row.key, isSecret: false, firstValue: row.value, bindings: [] };
    group.isSecret ||= row.isSecret;
    const isBound = group.bindings.some(binding => binding.service === row.service);
    if (!isBound) group.bindings.push({ service: row.service, env: row.key });
    groups.set(row.key, group);
  }

  return [...groups.values()];
}

function buildAskedValue(group: EnvGroup, customized: Customization): TemplateAskedValue {
  const common = {
    key: group.key,
    label: customized.label?.trim().slice(0, MAX_LABEL_LENGTH) || labelFromKey(group.key) || group.key,
    help: customized.help?.trim().slice(0, MAX_HELP_LENGTH) || undefined,
    bindings: group.bindings.slice(0, MAX_BINDINGS)
  };
  const type = resolveType(group, customized);

  if (type === "secret") return withoutUndefined({ ...common, type, required: customized.required ?? true });

  const defaultValue = readDefault(type, group.firstValue, customized);
  const required = customized.required ?? defaultValue === undefined;

  switch (type) {
    case "boolean":
      return withoutUndefined({ ...common, type, required, default: defaultValue as "true" | "false" | undefined });
    case "number":
      return withoutUndefined({
        ...common,
        type,
        required,
        default: defaultValue,
        min: customized.min,
        max: customized.max,
        integer: customized.integer ?? readGuessedIntegerFlag(group.firstValue)
      });
    case "choice":
      return withoutUndefined({ ...common, type, required, choices: readChoices(customized), default: defaultValue });
    case "text":
      return withoutUndefined({ ...common, type, required, default: defaultValue, minLength: customized.minLength, maxLength: customized.maxLength });
  }
}

function resolveType(group: EnvGroup, customized: Customization): AskedValueType {
  if (group.isSecret) return "secret";

  const guessedType = guessAskedValue({ value: group.firstValue, isSecret: false }).type;
  const hasNoChoices = customized.type === "choice" && readChoices(customized).length === 0;
  return customized.type && !hasNoChoices ? customized.type : guessedType;
}

function readDefault(type: AskedValueType, firstValue: string, customized: Customization): string | undefined {
  if (type === "boolean") {
    const guess = guessAskedValue({ value: firstValue, isSecret: false });
    return guess.type === "boolean" ? guess.default : undefined;
  }
  if (firstValue === "" || firstValue.length > MAX_DEFAULT_LENGTH) return undefined;
  if (type === "choice" && !readChoices(customized).includes(firstValue)) return undefined;
  return firstValue;
}

function readGuessedIntegerFlag(firstValue: string): boolean | undefined {
  const guess = guessAskedValue({ value: firstValue, isSecret: false });
  return guess.type === "number" ? guess.integer : undefined;
}

function readChoices(customized: Customization): string[] {
  return (customized.choices ?? []).slice(0, MAX_CHOICES).map(choice => choice.slice(0, MAX_CHOICE_LENGTH));
}

function withoutUndefined<T extends Record<string, unknown>>(fields: T): T {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T;
}
