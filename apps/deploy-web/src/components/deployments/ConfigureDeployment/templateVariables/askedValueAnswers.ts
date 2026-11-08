import type { SdlBuilderFormValuesType } from "@src/types";
import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { isSdlReference } from "@src/utils/sdl/sdlSecrets";

type ServicesOf = Pick<SdlBuilderFormValuesType, "services">;

export type BoundRow = { serviceIndex: number; envIndex: number };

export type Answer = { value: string; isPresent: boolean };

type Issue = { isEmpty: boolean; message: string };

type BoundVariable = BoundRow & { value: string | undefined };

/** Mirrors the api's check on a number default, so a value it would refuse as a default is refused here too. */
const PLAIN_DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

export function boundRowsOf(values: ServicesOf, askedValue: TemplateAskedValue): BoundRow[] {
  return boundVariablesOf(values, askedValue).map(({ serviceIndex, envIndex }) => ({ serviceIndex, envIndex }));
}

/** A secret row still holding the template's reference has no answer yet: the deployer has to type the value it stands for. */
export function answerOf(values: ServicesOf, askedValue: TemplateAskedValue): Answer {
  const [first] = boundVariablesOf(values, askedValue);
  if (!first) return { value: "", isPresent: false };

  const value = first.value ?? "";
  return { value: askedValue.type === "secret" && isSdlReference(value) ? "" : value, isPresent: true };
}

function boundVariablesOf({ services }: ServicesOf, askedValue: TemplateAskedValue): BoundVariable[] {
  return askedValue.bindings.flatMap(binding => {
    const serviceIndex = services.findIndex(service => service.title === binding.service);
    const env = services[serviceIndex]?.env ?? [];
    return env.flatMap((variable, envIndex) => (variable.key.trim() === binding.env ? [{ serviceIndex, envIndex, value: variable.value }] : []));
  });
}

export function withAnswer<T extends ServicesOf>(values: T, askedValue: TemplateAskedValue, answer: string): T {
  const rows = boundRowsOf(values, askedValue);
  const isBound = (serviceIndex: number, envIndex: number) => rows.some(row => row.serviceIndex === serviceIndex && row.envIndex === envIndex);

  return {
    ...values,
    services: values.services.map((service, serviceIndex) => ({
      ...service,
      env: service.env?.map((variable, envIndex) => (isBound(serviceIndex, envIndex) ? { ...variable, ...answerFields(askedValue, answer) } : variable))
    }))
  };
}

/** A secret answer is always marked secret, so a row the template left empty never carries the typed value into the SDL. */
export function answerFields(askedValue: TemplateAskedValue, answer: string): { value: string; isSecret?: true } {
  return askedValue.type === "secret" ? { value: answer, isSecret: true } : { value: answer };
}

export function askedValueIssuesOf(values: ServicesOf, askedValues: TemplateAskedValue[]): Record<string, string> {
  return Object.fromEntries(issueEntriesOf(values, askedValues).map(([key, issue]) => [key, issue.message]));
}

export function blockedReasonOf(values: ServicesOf, askedValues: TemplateAskedValue[]): string | undefined {
  const issues = issueEntriesOf(values, askedValues).map(([, issue]) => issue);
  const emptyCount = issues.filter(issue => issue.isEmpty).length;
  const invalidCount = issues.length - emptyCount;
  const parts = [
    emptyCount > 0 ? (emptyCount === 1 ? "1 required field is empty" : `${emptyCount} required fields are empty`) : undefined,
    invalidCount > 0 ? (invalidCount === 1 ? "1 field has an invalid value" : `${invalidCount} fields have an invalid value`) : undefined
  ].filter(part => part !== undefined);

  return parts.length > 0 ? parts.join(" and ") : undefined;
}

export function isAnswerRequired(askedValue: TemplateAskedValue): boolean {
  return askedValue.required || askedValue.type === "secret";
}

function issueEntriesOf(values: ServicesOf, askedValues: TemplateAskedValue[]): Array<[string, Issue]> {
  return askedValues.flatMap(askedValue => {
    const issue = issueOf(askedValue, answerOf(values, askedValue));
    return issue ? [[askedValue.key, issue] as [string, Issue]] : [];
  });
}

function issueOf(askedValue: TemplateAskedValue, answer: Answer): Issue | undefined {
  if (!answer.isPresent) return undefined;

  if (answer.value.trim() === "") {
    return isAnswerRequired(askedValue) ? { isEmpty: true, message: `Enter a value for ${askedValue.label} to continue.` } : undefined;
  }

  const message = constraintIssueOf(askedValue, answer.value.trim());
  return message ? { isEmpty: false, message } : undefined;
}

function constraintIssueOf(askedValue: TemplateAskedValue, value: string): string | undefined {
  switch (askedValue.type) {
    case "number":
      return numberIssueOf(askedValue, value);
    case "text":
      return textIssueOf(askedValue, value);
    case "choice":
      return askedValue.choices.includes(value) ? undefined : "Pick one of the choices.";
    default:
      return undefined;
  }
}

function numberIssueOf({ label, min, max, integer }: Extract<TemplateAskedValue, { type: "number" }>, value: string): string | undefined {
  if (!PLAIN_DECIMAL_PATTERN.test(value)) return `${label} is not a number.`;

  const number = Number(value);
  if (integer && !Number.isInteger(number)) return `${label} is not a whole number.`;
  if (number < (min ?? -Infinity)) return `${label} is below ${min}.`;
  if (number > (max ?? Infinity)) return `${label} is above ${max}.`;
  return undefined;
}

function textIssueOf({ label, minLength, maxLength }: Extract<TemplateAskedValue, { type: "text" }>, value: string): string | undefined {
  if (value.length < (minLength ?? 0)) return `${label} is shorter than ${minLength} characters.`;
  if (value.length > (maxLength ?? Infinity)) return `${label} is longer than ${maxLength} characters.`;
  return undefined;
}
