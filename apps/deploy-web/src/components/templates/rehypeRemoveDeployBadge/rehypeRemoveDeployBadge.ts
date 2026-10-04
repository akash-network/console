interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: { src?: unknown };
  children?: HastNode[];
}

const DEPLOY_BADGE_IMAGE_SUFFIX = "/deploy-with-akash-btn.svg";

/** Template READMEs carry a "Deploy on Akash" button for their GitHub page, which the template page already offers as Deploy template. */
export function rehypeRemoveDeployBadge() {
  return function removeDeployBadges(tree: HastNode) {
    removeBadgesFrom(tree);
  };
}

function removeBadgesFrom(parent: HastNode): boolean {
  let hasRemovedBadge = false;

  parent.children = parent.children?.filter(child => {
    if (isDeployBadgeImage(child)) {
      hasRemovedBadge = true;
      return false;
    }

    const hadBadgeInside = removeBadgesFrom(child);
    hasRemovedBadge ||= hadBadgeInside;
    return !(hadBadgeInside && isBlank(child));
  });

  return hasRemovedBadge;
}

function isDeployBadgeImage(node: HastNode): boolean {
  return node.tagName === "img" && String(node.properties?.src).split(/[?#]/)[0].endsWith(DEPLOY_BADGE_IMAGE_SUFFIX);
}

function isBlank(node: HastNode): boolean {
  return (node.children ?? []).every(child => child.type === "text" && !child.value?.trim());
}
