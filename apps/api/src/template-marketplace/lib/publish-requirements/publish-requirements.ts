/** Bumped whenever the community template terms change, so an acceptance names the text it was given for. */
export const COMMUNITY_TEMPLATE_TERMS_VERSION = "2026-11";

export const PUBLISH_REQUIREMENT_KEYS = ["email_verified", "organization_payment", "publisher_role", "publisher_in_good_standing"] as const;

export type PublishRequirementKey = (typeof PUBLISH_REQUIREMENT_KEYS)[number];

export type PublishRequirement = { key: PublishRequirementKey; met: boolean };

export type PublishRequirementFacts = {
  isEmailVerified: boolean;
  hasOrganizationPaid: boolean;
  mayPublishForOrganization: boolean;
  isPublisherSuspended: boolean;
};

export function evaluatePublishRequirements(facts: PublishRequirementFacts): PublishRequirement[] {
  return [
    { key: "email_verified", met: facts.isEmailVerified },
    { key: "organization_payment", met: facts.hasOrganizationPaid },
    { key: "publisher_role", met: facts.mayPublishForOrganization },
    { key: "publisher_in_good_standing", met: !facts.isPublisherSuspended }
  ];
}

export function areRequirementsMet(requirements: PublishRequirement[]): boolean {
  return requirements.every(requirement => requirement.met);
}
