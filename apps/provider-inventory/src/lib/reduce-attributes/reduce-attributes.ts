import type { SelfAttribute, SignedAttribute } from "@src/types/chain-provider";
import type { ReducedAttributes } from "@src/types/inventory";

export function reduceAttributes(selfAttributes: SelfAttribute[], signedAttributes: SignedAttribute[]): ReducedAttributes {
  const auditedBySet = new Set<string>();
  for (const attr of signedAttributes) {
    auditedBySet.add(attr.auditor);
  }

  return {
    selfAttributes: selfAttributes.map(a => ({ key: a.key, value: a.value })),
    signedAttributes: signedAttributes.map(a => ({ key: a.key, value: a.value, auditor: a.auditor })),
    auditedBy: [...auditedBySet].sort()
  };
}
