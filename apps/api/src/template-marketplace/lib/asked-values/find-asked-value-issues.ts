import { yaml } from "@akashnetwork/chain-sdk";

import type { AskedValue } from "./asked-values.schema";

const UNREADABLE_SDL_ISSUE = "The SDL could not be read";

export function findAskedValueIssues(sdl: string, askedValues: AskedValue[]): string[] {
  const services = readServiceNames(sdl);
  if (!services) return [UNREADABLE_SDL_ISSUE];

  const issues: string[] = [];
  const declaredKeys = new Set<string>();
  const bindingOwners = new Map<string, string>();

  for (const askedValue of askedValues) {
    if (declaredKeys.has(askedValue.key)) {
      issues.push(`Variable "${askedValue.key}" is declared twice`);
    }
    declaredKeys.add(askedValue.key);

    for (const { service, env } of askedValue.bindings) {
      if (!services.has(service)) {
        issues.push(`Variable "${askedValue.key}" fills in service "${service}", which the SDL does not define`);
      }

      const bindingId = `${service}.env.${env}`;
      const owner = bindingOwners.get(bindingId);
      if (owner === undefined) {
        bindingOwners.set(bindingId, askedValue.key);
      } else if (owner !== askedValue.key) {
        issues.push(`Variables "${owner}" and "${askedValue.key}" both fill in ${bindingId}`);
      }
    }

    issues.push(...findConstraintIssues(askedValue));
  }

  return issues;
}

function readServiceNames(sdl: string): Set<string> | undefined {
  let document: unknown;
  try {
    document = yaml.raw(sdl);
  } catch {
    return undefined;
  }

  if (!isRecord(document)) return undefined;

  return new Set(isRecord(document.services) ? Object.keys(document.services) : []);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findConstraintIssues(askedValue: AskedValue): string[] {
  switch (askedValue.type) {
    case "number":
      return [...findInvertedRangeIssues(askedValue.key, askedValue.min, askedValue.max), ...findNumberDefaultIssues(askedValue)];
    case "text":
      return [...findInvertedRangeIssues(askedValue.key, askedValue.minLength, askedValue.maxLength), ...findTextDefaultIssues(askedValue)];
    case "choice":
      return askedValue.default !== undefined && !askedValue.choices.includes(askedValue.default)
        ? [defaultIssue(askedValue.key, "is not one of its choices")]
        : [];
    default:
      return [];
  }
}

function findInvertedRangeIssues(key: string, minimum: number | undefined, maximum: number | undefined): string[] {
  return minimum !== undefined && maximum !== undefined && minimum > maximum ? [`Variable "${key}" has a minimum above its maximum`] : [];
}

function findNumberDefaultIssues({ key, default: value, min, max, integer }: Extract<AskedValue, { type: "number" }>): string[] {
  if (value === undefined) return [];

  const number = Number(value);
  if (value.trim() === "" || Number.isNaN(number)) return [defaultIssue(key, "is not a number")];

  const issues: string[] = [];
  if (integer && !Number.isInteger(number)) issues.push(defaultIssue(key, "is not a whole number"));
  if (min !== undefined && number < min) issues.push(defaultIssue(key, `is below ${min}`));
  if (max !== undefined && number > max) issues.push(defaultIssue(key, `is above ${max}`));
  return issues;
}

function findTextDefaultIssues({ key, default: value, minLength, maxLength }: Extract<AskedValue, { type: "text" }>): string[] {
  if (value === undefined) return [];

  const issues: string[] = [];
  if (minLength !== undefined && value.length < minLength) issues.push(defaultIssue(key, `is shorter than ${minLength} characters`));
  if (maxLength !== undefined && value.length > maxLength) issues.push(defaultIssue(key, `is longer than ${maxLength} characters`));
  return issues;
}

function defaultIssue(key: string, reason: string): string {
  return `Variable "${key}" has a default that ${reason}`;
}
