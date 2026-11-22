import { isApiError } from "@akashnetwork/openapi-sdk";

export type RemovedTemplate = { title: string | undefined };

const REMOVED_STATUS = 410;

const REMOVED_CODE = "template_removed";

type RemovedBody = { code?: unknown; data?: unknown };

/** Every read of a template that was public once answers 410 with its title after it is deleted, so its link can say what happened. */
export function readRemovedTemplate(error: unknown): RemovedTemplate | undefined {
  if (!isApiError(error) || error.status !== REMOVED_STATUS) return undefined;

  const body: RemovedBody = error.body && typeof error.body === "object" ? error.body : {};
  if (body.code !== REMOVED_CODE) return undefined;

  return { title: titleOf(body.data) };
}

function titleOf(data: unknown): string | undefined {
  const title = data && typeof data === "object" && "title" in data ? data.title : undefined;
  return typeof title === "string" && title.trim() ? title : undefined;
}
