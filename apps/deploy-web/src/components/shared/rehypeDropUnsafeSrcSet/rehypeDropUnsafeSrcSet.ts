interface HastNode {
  type: string;
  properties?: { srcSet?: unknown };
  children?: HastNode[];
}

const IMAGE_URL_PROTOCOLS = ["http:", "https:"];
const RELATIVE_URL_BASE = "https://readme.invalid";

/** A sanitize schema checks the protocol of one URL per attribute, which a srcset's list of candidates slips past. */
export function rehypeDropUnsafeSrcSet() {
  return function dropUnsafeSrcSets(tree: HastNode) {
    dropUnsafeSrcSetsFrom(tree);
  };
}

function dropUnsafeSrcSetsFrom(node: HastNode): void {
  if (node.properties?.srcSet !== undefined && !isSafeSrcSet(node.properties.srcSet)) {
    delete node.properties.srcSet;
  }

  node.children?.forEach(dropUnsafeSrcSetsFrom);
}

function isSafeSrcSet(srcSet: unknown): boolean {
  const candidates = Array.isArray(srcSet) ? srcSet.map(String) : String(srcSet).split(",");

  return candidates.every(candidate => isRelativeOrHttpUrl(candidate.trim().split(/\s+/)[0]));
}

function isRelativeOrHttpUrl(url: string): boolean {
  try {
    return IMAGE_URL_PROTOCOLS.includes(new URL(url, RELATIVE_URL_BASE).protocol);
  } catch {
    return false;
  }
}
