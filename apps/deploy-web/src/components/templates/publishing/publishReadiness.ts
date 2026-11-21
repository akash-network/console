import type { TemplatePublishCheck, TemplatePublishReadiness } from "@src/types/marketplace-template";

export type PublishOrganization = { name: string; type: "personal" | "team" };

export type PublishCheckFix = "rename" | "rename-organization" | "edit-configuration" | "edit-readme";

export type PublishRequirementFix = "verify-email" | "add-credits" | "contact-support";

export type PublishRequirementCopy = { label: string; help: string; fix?: PublishRequirementFix };

type Requirement = { key: string; met: boolean };

const CHECK_LABELS = new Map<string, string>([
  ["sdl_valid", "SDL is valid"],
  ["no_secrets", "No secrets in values"],
  ["images_allowed", "Images allowed"],
  ["fixed_tags", "Images use a fixed tag"],
  ["name_not_reserved", "Name not reserved"],
  ["text_within_limits", "Text within limits"]
]);

const CONFIGURATION_CHECK_KEYS = ["sdl_valid", "no_secrets", "images_allowed", "fixed_tags"];

const RESERVED_NAME_CHECK_KEY = "name_not_reserved";

const PUBLISHER_NAME_FIELD = "publisher_name";

const README_FIELD = "readme";

/** The API adds checks and requirements over time, so a key this build has never seen still gets a readable name. */
export function readableKeyOf(key: string): string {
  const words = key.replace(/_+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function publishCheckLabelOf(key: string): string {
  return CHECK_LABELS.get(key) ?? readableKeyOf(key);
}

export function publishCheckFixesOf(check: TemplatePublishCheck): PublishCheckFix[] {
  if (check.status !== "failed") return [];
  if (CONFIGURATION_CHECK_KEYS.includes(check.key)) return configurationFixesOf(check);
  if (check.key !== RESERVED_NAME_CHECK_KEY) return [];

  const fixes: PublishCheckFix[] = [];
  if (check.issues.some(issue => issue.field !== PUBLISHER_NAME_FIELD)) fixes.push("rename");
  if (check.issues.some(issue => issue.field === PUBLISHER_NAME_FIELD)) fixes.push("rename-organization");
  return fixes;
}

/** A credential can sit in the README, which is edited on the template page and not in Configure. */
function configurationFixesOf(check: TemplatePublishCheck): PublishCheckFix[] {
  const readmeIssues = check.issues.filter(issue => issue.field === README_FIELD);
  const fixes: PublishCheckFix[] = [];
  if (readmeIssues.length === 0 || readmeIssues.length < check.issues.length) fixes.push("edit-configuration");
  if (readmeIssues.length > 0) fixes.push("edit-readme");
  return fixes;
}

export function failedPublishChecksOf(checks: TemplatePublishCheck[]): TemplatePublishCheck[] {
  return checks.filter(check => check.status === "failed");
}

export function countPublishBlockers(readiness: Pick<TemplatePublishReadiness, "requirements" | "checks">): number {
  return readiness.requirements.filter(requirement => !requirement.met).length + failedPublishChecksOf(readiness.checks).length;
}

export function describePublishRequirement(requirement: Requirement, organization: PublishOrganization | null): PublishRequirementCopy {
  const isTeam = organization?.type === "team";
  const publisher = isTeam ? organization.name : "your account";

  switch (requirement.key) {
    case "email_verified":
      return { label: "Email verified", help: "Public templates come from people with a verified email.", fix: "verify-email" };
    case "organization_payment":
      return {
        label: isTeam ? "Organization has a successful payment" : "Account has a successful payment",
        help: `Public templates need at least one completed payment on ${publisher}. Trial credits don't count.`,
        fix: "add-credits"
      };
    case "publisher_role":
      return isTeam
        ? {
            label: `Owner or admin of ${organization.name}`,
            help: `Public templates are published under the name ${organization.name}, so only its owners and admins can make one public. Ask an owner or admin of ${organization.name}.`
          }
        : { label: "Your own account", help: "Only the owner of this account can make its templates public." };
    case "publisher_in_good_standing":
      return {
        label: "Publisher in good standing",
        help: `Akash paused publishing for ${publisher}. Contact support to find out why.`,
        fix: "contact-support"
      };
    default:
      return { label: readableKeyOf(requirement.key), help: "This requirement isn't met yet." };
  }
}
