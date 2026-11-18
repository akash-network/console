import { UrlService } from "@src/utils/urlUtils";

export const DEPLOY_BADGE_IMAGE_PATH = "/images/deploy-with-akash-btn.svg";

export const DEPLOY_BADGE_ALT = "Deploy on Akash";

export const TEMPLATE_ARRIVAL_SOURCE_PARAM = "utm_source";

export const DEPLOY_BADGE_SOURCE = "badge";

export type DeployBadge = { imageUrl: string; linkUrl: string; markdown: string; html: string };

/** Built from the template id only: a title or summary in a snippet would let a publisher's text break out of the markup people paste into their README. */
export function buildDeployBadge(baseUrl: string, templateId: string): DeployBadge {
  const imageUrl = `${baseUrl}${DEPLOY_BADGE_IMAGE_PATH}`;
  const linkUrl = `${baseUrl}${UrlService.template(encodeURIComponent(templateId))}?${TEMPLATE_ARRIVAL_SOURCE_PARAM}=${DEPLOY_BADGE_SOURCE}`;

  return {
    imageUrl,
    linkUrl,
    markdown: `[![${DEPLOY_BADGE_ALT}](${imageUrl})](${linkUrl})`,
    html: `<a href="${linkUrl}"><img src="${imageUrl}" alt="${DEPLOY_BADGE_ALT}" height="44"></a>`
  };
}

export function isDeployBadgeArrival(source: unknown): boolean {
  return source === DEPLOY_BADGE_SOURCE;
}
