interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const NO_OPENER_REL = ["noopener", "noreferrer"];

/** Markdown opens every link in a new tab, which must never get a handle back to the console, whatever rel the source wrote. */
export function rehypeOpenLinksWithoutOpener() {
  return function setNoOpenerOnLinks(tree: HastNode) {
    setNoOpenerOnLinksIn(tree);
  };
}

function setNoOpenerOnLinksIn(node: HastNode): void {
  if (node.tagName === "a") {
    node.properties = { ...node.properties, rel: [...NO_OPENER_REL] };
  }

  node.children?.forEach(setNoOpenerOnLinksIn);
}
