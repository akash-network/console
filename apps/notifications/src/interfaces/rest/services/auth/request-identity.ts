import type { IncomingHttpHeaders } from "node:http";
import { z } from "zod";

export const IDENTITY_HEADERS = {
  userId: "x-user-id",
  organizationId: "x-organization-id",
  organizationType: "x-organization-type",
  organizationRole: "x-organization-role",
  projectScope: "x-project-scope",
  projectId: "x-project-id"
} as const;

const organizationRoleSchema = z.enum(["owner", "admin", "member", "billing", "viewer"]);

const projectScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("projects"), projectIds: z.array(z.string().uuid()) })
]);

const organizationTypeSchema = z.enum(["personal", "team"]);

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export type OrganizationType = z.infer<typeof organizationTypeSchema>;

export type ProjectScope = z.infer<typeof projectScopeSchema>;

export interface OrganizationMembership {
  organizationId: string;
  role: OrganizationRole;
  projectScope: ProjectScope;
}

export interface RequestIdentity {
  userId: string;
  organizationId: string | null;
  /** Null when the api minted none, which counts as a team organization wherever the difference matters. */
  organizationType: OrganizationType | null;
  projectId: string | null;
  /** Set only when the api enforces organization rules for the request, which it signals by minting the role. */
  membership: OrganizationMembership | null;
}

const identityHeadersSchema = z
  .object({
    [IDENTITY_HEADERS.userId]: z.string().min(1),
    [IDENTITY_HEADERS.organizationId]: z.string().uuid().optional(),
    [IDENTITY_HEADERS.organizationType]: organizationTypeSchema.optional(),
    [IDENTITY_HEADERS.projectId]: z.string().uuid().optional(),
    [IDENTITY_HEADERS.organizationRole]: organizationRoleSchema.optional(),
    [IDENTITY_HEADERS.projectScope]: z.string().optional()
  })
  .transform((headers, context): RequestIdentity => {
    const organizationId = headers[IDENTITY_HEADERS.organizationId] ?? null;
    const role = headers[IDENTITY_HEADERS.organizationRole];
    const identity = {
      userId: headers[IDENTITY_HEADERS.userId],
      organizationId,
      organizationType: headers[IDENTITY_HEADERS.organizationType] ?? null,
      projectId: headers[IDENTITY_HEADERS.projectId] ?? null
    };

    if (!role) {
      return { ...identity, membership: null };
    }

    const projectScope = parseProjectScope(headers[IDENTITY_HEADERS.projectScope]);

    if (!organizationId || !projectScope) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Organization role requires an organization and a project scope" });
      return z.NEVER;
    }

    return { ...identity, membership: { organizationId, role, projectScope } };
  });

function parseProjectScope(header: string | undefined): ProjectScope | undefined {
  try {
    return projectScopeSchema.parse(JSON.parse(header ?? ""));
  } catch {
    return undefined;
  }
}

export function readRequestIdentity(headers: IncomingHttpHeaders): RequestIdentity | undefined {
  const result = identityHeadersSchema.safeParse(headers);

  return result.success ? result.data : undefined;
}

/** Rows filed in no organization predate organizations and belong to their owner's personal one, so only a request in no organization or in a personal one reaches them. */
export function reachesUnattributedRows({ organizationId, organizationType }: Pick<RequestIdentity, "organizationId" | "organizationType">): boolean {
  return organizationId === null || organizationType === "personal";
}
