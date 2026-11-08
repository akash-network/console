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

type EnvRow = { service: string; key: string; value: string; isSecret: boolean };

type EnvGroup = { key: string; isSecret: boolean; firstValue: string; bindings: Array<{ service: string; env: string }> };

export function buildAskedValues(services: ServiceType[], settings: Record<string, AskedValueSetting>): TemplateAskedValue[] {
  const askedValues: TemplateAskedValue[] = [];

  for (const group of groupByKey(services)) {
    const setting = settings[group.key];
    if (!group.isSecret && !setting?.isAsked) continue;

    askedValues.push(buildAskedValue(group, setting?.customized ?? {}));
  }

  return askedValues.slice(0, MAX_ASKED_VALUES);
}

export function summarizeAskedValues(
  values: TemplateAskedValue[],
  services: ServiceType[]
): { asked: number; secrets: number; needsAttention: number; savedAsIs: string[] } {
  const askedKeys = new Set(values.map(value => value.key));
  const plainRows = listEnvRows(services).filter(row => !row.isSecret);
  const unaskedKeys = plainRows.map(row => row.key).filter(key => !askedKeys.has(key));

  return {
    asked: values.length,
    secrets: values.filter(value => value.type === "secret").length,
    needsAttention: plainRows.filter(row => looksLikeSecret(row.key, row.value)).length,
    savedAsIs: [...new Set(unaskedKeys)]
  };
}

function listEnvRows(services: ServiceType[]): EnvRow[] {
  const reservedKeys: readonly string[] = RESERVED_ENV_KEYS;

  return services.flatMap(service =>
    (service.env ?? []).flatMap(variable => {
      const key = variable.key.trim();
      return key === "" || reservedKeys.includes(key) ? [] : [{ service: service.title, key, value: variable.value ?? "", isSecret: !!variable.isSecret }];
    })
  );
}

function groupByKey(services: ServiceType[]): EnvGroup[] {
  const groups = new Map<string, EnvGroup>();

  for (const row of listEnvRows(services)) {
    if (!ASKED_VALUE_KEY_PATTERN.test(row.key)) continue;

    const group = groups.get(row.key) ?? { key: row.key, isSecret: false, firstValue: row.value, bindings: [] };
    group.isSecret ||= row.isSecret;
    group.bindings.push({ service: row.service, env: row.key });
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
