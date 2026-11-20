import { isApiError } from "@akashnetwork/openapi-sdk";

export type PublisherProfileRefusal = { kind: "invalid"; issues: string[] } | { kind: "signed_out" | "forbidden" | "not_publisher" };

const KIND_BY_STATUS: Record<number, "signed_out" | "forbidden" | "not_publisher"> = {
  401: "signed_out",
  403: "forbidden",
  404: "not_publisher"
};

const FIELD_NAMES: Record<string, string> = { bio: "Bio", links: "Links" };

/** Undefined for a server error or a request that never arrived, which are Console's to answer for and worth a retry. */
export function readPublisherProfileRefusal(error: unknown): PublisherProfileRefusal | undefined {
  if (!isApiError(error)) return undefined;
  if (error.status === 400) return { kind: "invalid", issues: readIssues(error.body) };

  const kind = KIND_BY_STATUS[error.status];
  return kind && { kind };
}

export function describePublisherProfileRefusal(refusal: PublisherProfileRefusal | undefined): string {
  switch (refusal?.kind) {
    case "invalid":
      return refusal.issues.length > 0
        ? `The profile wasn't saved. ${refusal.issues.join("; ")}.`
        : "The profile wasn't saved. Check the bio and the links and try again.";
    case "signed_out":
      return "Your session ended. Sign in again to save the profile.";
    case "forbidden":
      return "Only an owner or admin of the organization can change its publisher profile.";
    case "not_publisher":
      return "This organization has not published a template yet, so it has no publisher profile to change.";
    default:
      return "Couldn't save the profile. Try again in a moment.";
  }
}

function readIssues(body: unknown): string[] {
  const issues = body && typeof body === "object" && "data" in body && Array.isArray(body.data) ? body.data : [];

  return issues.flatMap(issue => {
    const message: unknown = issue?.message;
    return typeof message === "string" && message ? [`${describeField(issue.path)}${message}`] : [];
  });
}

function describeField(path: unknown): string {
  const [field, index, part] = Array.isArray(path) ? path.filter(segment => segment !== "data") : [];

  if (field === "links" && typeof index === "number") return `Link ${index + 1}${part === "label" ? " label" : ""}: `;
  return typeof field === "string" && FIELD_NAMES[field] ? `${FIELD_NAMES[field]}: ` : "";
}
