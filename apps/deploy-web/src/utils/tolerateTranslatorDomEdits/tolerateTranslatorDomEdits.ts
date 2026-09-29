import type { LoggerService } from "@akashnetwork/logging";

/** Browser translators replace text nodes React still holds with their own elements, and React's next removal or insertion next to such a node would throw and crash the page. */
export function tolerateTranslatorDomEdits(target: Pick<Node, "removeChild" | "insertBefore">, logger: Pick<LoggerService, "warn">) {
  const removeChild = target.removeChild;
  const insertBefore = target.insertBefore;

  target.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode === this) {
      removeChild.call(this, child);
    } else {
      logger.warn({ event: "DOM_REMOVE_CHILD_NOT_IN_PARENT_SKIPPED", nodeName: child.nodeName });
    }
    return child;
  };

  target.insertBefore = function <T extends Node>(this: Node, node: T, referenceNode: Node | null): T {
    const isReferenceInParent = !referenceNode || referenceNode.parentNode === this;
    if (!isReferenceInParent) {
      logger.warn({ event: "DOM_INSERT_BEFORE_NODE_NOT_IN_PARENT_APPENDED", nodeName: referenceNode.nodeName });
    }
    insertBefore.call(this, node, isReferenceInParent ? referenceNode : null);
    return node;
  };
}
