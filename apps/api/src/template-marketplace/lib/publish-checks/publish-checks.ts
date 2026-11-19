import { yaml } from "@akashnetwork/chain-sdk";

import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { findSecretValueIssues, readSdlEnvValues } from "@src/template-marketplace/lib/asked-values/find-secret-value-issues";
import { type BlockedImageKind, findBlockedImageKind } from "./blocked-images";
import { type CredentialSign, findCredentialSign, findKnownCredentialOffsets } from "./credential-signs";
import { isPinned, parseImageReference } from "./image-reference";
import { type PublishCheckIssue, type PublishCheckResults, toPublishCheck } from "./publish-check-results";
import { findReservedWords } from "./reserved-names";

export type PublishCheckInput = {
  sdl: string;
  /** The README readers of the template are shown, which for a version without one is the template description. */
  readme: string | null;
  askedValues: AskedValue[];
  title: string;
  /** Null for a template filed in no organization, which has no name to publish under. */
  publisherName: string | null;
  /** What the SDL validation every save runs found, so a template is held to one parser. */
  sdlIssues: string[];
  ranAt: Date;
};

type ServiceImage = { service: string; image: string };

const SDL_TOO_LARGE_ISSUE = `The SDL is larger than ${SDL_MAX_LENGTH / 1024} KB. Shorten it before making the template public.`;

const CREDENTIAL_SIGN_LABELS: Record<CredentialSign, string> = {
  known_format: "holds a key or token in a format providers issue",
  credential_name: "is named like a key, token or password and holds a value",
  credential_assignment: "sets a value under a name that reads like a key, token or password",
  random_string: "holds a long random string that reads like a key or token"
};

const BLOCKED_IMAGE_LABELS: Record<BlockedImageKind, string> = {
  miner: "a cryptocurrency miner",
  proxyware: "a bandwidth-sharing proxy"
};

export function runPublishChecks(input: PublishCheckInput): PublishCheckResults {
  const images = readServiceImages(input.sdl);

  return {
    ranAt: input.ranAt.toISOString(),
    checks: [
      toPublishCheck("sdl_valid", findSdlIssues(input)),
      toPublishCheck("no_secrets", findSecretIssues(input)),
      toPublishCheck("images_allowed", images.flatMap(findBlockedImageIssue)),
      toPublishCheck("fixed_tags", images.flatMap(findFloatingTagIssue)),
      toPublishCheck("name_not_reserved", findReservedNameIssues(input))
    ]
  };
}

function findSdlIssues({ sdl, sdlIssues }: PublishCheckInput): PublishCheckIssue[] {
  const sizeIssues = sdl.length > SDL_MAX_LENGTH ? [SDL_TOO_LARGE_ISSUE] : [];

  return [...sizeIssues, ...sdlIssues].map(message => ({ message }));
}

function findSecretIssues({ sdl, readme, askedValues }: PublishCheckInput): PublishCheckIssue[] {
  const secretBindings = new Set(
    askedValues
      .filter(askedValue => askedValue.type === "secret")
      .flatMap(askedValue => askedValue.bindings.map(binding => bindingKey(binding.service, binding.env)))
  );
  const credentialEnvValues = readSdlEnvValues(sdl).flatMap(entry => {
    const sign = findCredentialSign(entry.value, entry.variable);

    return sign ? [{ ...entry, sign }] : [];
  });
  const envIssues = credentialEnvValues
    .filter(({ service, variable }) => !secretBindings.has(bindingKey(service, variable)))
    .map(
      ({ service, variable, sign }): PublishCheckIssue => ({
        message: `${service}.env.${variable} ${CREDENTIAL_SIGN_LABELS[sign]}. Remove the value, or ask the deployer for it as a secret so nobody deploys with yours.`,
        service,
        variable
      })
    );
  const envValuesReportedByVariable = credentialEnvValues.map(({ value }) => value);

  return [
    ...findSecretValueIssues(sdl, askedValues).map(message => ({ message })),
    ...envIssues,
    ...findCredentialLineIssues(sdl, "sdl", envValuesReportedByVariable),
    ...askedValues.flatMap(findDefaultIssue),
    ...findReadmeSecretIssues(readme ?? "")
  ];
}

export function findReadmeSecretIssues(readme: string): PublishCheckIssue[] {
  return findCredentialLineIssues(readme, "readme", []);
}

const CREDENTIAL_LINE_SOURCES = { sdl: "the SDL", readme: "the README" };

const MAX_REPORTED_CREDENTIAL_LINES = 20;

const EVERYTHING_BUT_LINE_BREAKS = /[^\r\n]/g;

/** Each value left out costs a pass over the whole text, so an SDL of thousands of reported values must not buy thousands of passes. */
const MAX_VALUES_LEFT_OUT = 50;

/** Reads the text as written, so a key in a comment, an argument, a secret's name or the README is found too; an env value already reported under its variable is left out, which hides nothing, since that report alone fails the check. */
function findCredentialLineIssues(text: string, field: keyof typeof CREDENTIAL_LINE_SOURCES, reportedValues: string[]): PublishCheckIssue[] {
  const valuesLeftOut = [...new Set(reportedValues)].slice(0, MAX_VALUES_LEFT_OUT);
  const unreportedText = valuesLeftOut.reduce((rest, value) => rest.replaceAll(value, value.replace(EVERYTHING_BUT_LINE_BREAKS, " ")), text);

  return findLineNumbers(unreportedText, findKnownCredentialOffsets(unreportedText))
    .slice(0, MAX_REPORTED_CREDENTIAL_LINES)
    .map(lineNumber => ({
      message: `Line ${lineNumber} of ${CREDENTIAL_LINE_SOURCES[field]} ${CREDENTIAL_SIGN_LABELS.known_format}. Remove it before the template is public; anyone could read and use it.`,
      field
    }));
}

/** Walks the text once for all offsets, since counting the lines before each one separately grows with their product. */
function findLineNumbers(text: string, offsets: number[]): number[] {
  const lineNumbers = new Set<number>();
  let lineNumber = 1;
  let lineStart = 0;

  for (const offset of [...offsets].sort((first, second) => first - second)) {
    for (let lineBreak = text.indexOf("\n", lineStart); lineBreak !== -1 && lineBreak < offset; lineBreak = text.indexOf("\n", lineStart)) {
      lineNumber++;
      lineStart = lineBreak + 1;
    }

    lineNumbers.add(lineNumber);
  }

  return [...lineNumbers];
}

/** A stored version predating the schema's refusal could still carry a secret's default, which the type no longer admits. */
function findDefaultIssue(askedValue: AskedValue): PublishCheckIssue[] {
  const { key, type, default: storedDefault }: { key: string; type: string; default?: string } = askedValue;

  if (storedDefault === undefined) return [];

  if (type === "secret") {
    return [{ message: `Variable "${key}" is a secret, so it must not carry a default. Clear the default.`, variable: key }];
  }

  const sign = findCredentialSign(storedDefault, key);

  return sign
    ? [{ message: `The default of variable "${key}" ${CREDENTIAL_SIGN_LABELS[sign]}. Clear the default, or make the variable a secret.`, variable: key }]
    : [];
}

function findBlockedImageIssue({ service, image }: ServiceImage): PublishCheckIssue[] {
  const kind = findBlockedImageKind(image);

  return kind
    ? [
        {
          message: `Service "${service}" runs ${image}, which is ${BLOCKED_IMAGE_LABELS[kind]}. Public templates can't use it; change the image.`,
          service,
          image
        }
      ]
    : [];
}

function findFloatingTagIssue({ service, image }: ServiceImage): PublishCheckIssue[] {
  const reference = parseImageReference(image);

  if (isPinned(reference)) return [];

  const problem = reference.tag ? `uses ${image}, and the latest tag changes whenever the image is rebuilt` : `uses ${image} without a tag, which means latest`;

  return [
    {
      message: `Service "${service}" ${problem}. Pick a version tag such as ${reference.repository}:1.2.3, or a digest, so the image can't change after the template is public.`,
      service,
      image
    }
  ];
}

export function findReservedTitleIssues(title: string): PublishCheckIssue[] {
  return findReservedWords(title).map(word => ({
    message: `Titles can't contain "${word}", which is reserved for Akash. Rename the template.`,
    field: "title"
  }));
}

function findReservedNameIssues({ title, publisherName }: PublishCheckInput): PublishCheckIssue[] {
  const publisherIssues = findReservedWords(publisherName ?? "").map(
    (word): PublishCheckIssue => ({
      message: `Templates are published under your organization's name, and "${publisherName}" contains "${word}", which is reserved for Akash. Rename the organization, or your username for a personal account.`,
      field: "publisher_name"
    })
  );

  return [...findReservedTitleIssues(title), ...publisherIssues];
}

function readServiceImages(sdl: string): ServiceImage[] {
  const services = readServices(sdl);

  return Object.entries(services).flatMap(([service, definition]) =>
    isMapping(definition) && typeof definition.image === "string" && definition.image.trim() ? [{ service, image: definition.image.trim() }] : []
  );
}

function readServices(sdl: string): Record<string, unknown> {
  try {
    const document: unknown = yaml.raw(sdl);

    return isMapping(document) && isMapping(document.services) ? document.services : {};
  } catch {
    return {};
  }
}

function bindingKey(service: string, variable: string): string {
  return JSON.stringify([service, variable]);
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
