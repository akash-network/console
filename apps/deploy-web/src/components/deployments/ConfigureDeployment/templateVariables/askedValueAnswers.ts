import type { SdlBuilderFormValuesType } from "@src/types";
import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { isSdlReference } from "@src/utils/sdl/sdlSecrets";

type ServicesOf = Pick<SdlBuilderFormValuesType, "services">;

export type Answer = { value: string; isPresent: boolean };

export type AnswerOptions = {
  /** Once the deployment exists its create sealed the secrets, so a row still holding a kept reference is answered, as the deploy accepts it. */
  isDeploymentCreated?: boolean;
};

type Issue = { isEmpty: boolean; message: string };

/** Mirrors the api's check on a number default, so a value it would refuse as a default is refused here too. */
const PLAIN_DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/** A secret row still holding the template's reference has no answer yet, and an unset yes/no reads as the No it shows. */
export function answerOf(values: ServicesOf, askedValue: TemplateAskedValue): Answer {
  const [first] = boundValuesOf(values, askedValue);
  if (first === undefined) return { value: "", isPresent: false };

  return { value: readAnswer(askedValue, first, {}), isPresent: true };
}

export function withAnswer<T extends ServicesOf>(values: T, askedValue: TemplateAskedValue, answer: string): T {
  const fields = askedValue.type === "secret" ? { value: answer, isSecret: true } : { value: answer };

  return {
    ...values,
    services: values.services.map(service => {
      const isBoundRow = (key: string) => isBound(askedValue, service.title, key);
      if (!service.env?.some(variable => isBoundRow(variable.key))) return service;
      return { ...service, env: service.env.map(variable => (isBoundRow(variable.key) ? { ...variable, ...fields } : variable)) };
    })
  };
}

/** The switch shows an unset yes/no as No, so the SDL is given that No too rather than an empty value the deployed app would read differently. */
export function withUnsetYesNoAsNo<T extends ServicesOf>(values: T, askedValues: TemplateAskedValue[]): T {
  return askedValues.reduce((answered, askedValue) => {
    const boundValues = boundValuesOf(answered, askedValue);
    const isUnsetYesNo = askedValue.type === "boolean" && boundValues.length > 0 && boundValues.every(value => value === "");
    return isUnsetYesNo ? withAnswer(answered, askedValue, "false") : answered;
  }, values);
}

export function askedValueIssuesOf(values: ServicesOf, askedValues: TemplateAskedValue[], options: AnswerOptions = {}): Record<string, string> {
  return Object.fromEntries(issueEntriesOf(values, askedValues, options).map(([key, issue]) => [key, issue.message]));
}

export function blockedReasonOf(values: ServicesOf, askedValues: TemplateAskedValue[], options: AnswerOptions = {}): string | undefined {
  const issues = issueEntriesOf(values, askedValues, options).map(([, issue]) => issue);
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

function isKeptSecretReference(askedValue: TemplateAskedValue, value: string): boolean {
  return askedValue.type === "secret" && isSdlReference(value);
}

function isBound(askedValue: TemplateAskedValue, serviceTitle: string, key: string): boolean {
  return askedValue.bindings.some(binding => binding.service === serviceTitle && binding.env === key.trim());
}

function boundValuesOf({ services }: ServicesOf, askedValue: TemplateAskedValue): string[] {
  return services.flatMap(service =>
    (service.env ?? []).filter(variable => isBound(askedValue, service.title, variable.key)).map(variable => variable.value ?? "")
  );
}

function readAnswer(askedValue: TemplateAskedValue, value: string, options: AnswerOptions): string {
  if (isKeptSecretReference(askedValue, value)) return options.isDeploymentCreated ? value : "";
  return askedValue.type === "boolean" && value === "" ? "false" : value;
}

function issueEntriesOf(values: ServicesOf, askedValues: TemplateAskedValue[], options: AnswerOptions): Array<[string, Issue]> {
  return askedValues.flatMap(askedValue => {
    const issue = issueOf(askedValue, boundValuesOf(values, askedValue), options);
    return issue ? [[askedValue.key, issue] as [string, Issue]] : [];
  });
}

function issueOf(askedValue: TemplateAskedValue, boundValues: string[], options: AnswerOptions): Issue | undefined {
  const isRequired = isAnswerRequired(askedValue);
  if (boundValues.length === 0) {
    return isRequired
      ? { isEmpty: true, message: `${askedValue.label} isn't in this configuration anymore. Restore its row or reset the configuration.` }
      : undefined;
  }

  const answers = boundValues.map(value => readAnswer(askedValue, value, options));
  if (isRequired && answers.some(answer => answer.trim() === "")) {
    return { isEmpty: true, message: `Enter a value for ${askedValue.label} to continue.` };
  }

  const message = answers
    .filter(answer => answer.trim() !== "")
    .map(answer => constraintIssueOf(askedValue, answer))
    .find(Boolean);
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
    case "boolean":
      return value === "true" || value === "false" ? undefined : "Pick Yes or No.";
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
