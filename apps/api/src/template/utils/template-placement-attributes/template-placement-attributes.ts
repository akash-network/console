import type { Document, ParsedNode, Range, Scalar, YAMLMap } from "yaml";
import { isMap, isScalar, parseDocument } from "yaml";

type PlacementAttributes = { profile: YAMLMap; key: Scalar.Parsed; value: ParsedNode | null };

/** Console's deploy UI can neither show nor edit placement attributes, and an attribute the required auditor never signed leaves a deployment with no bids. */
export function withoutPlacementAttributes(sdl: string): string {
  const document = parseDocument(sdl);
  const placementAttributes = document.errors.length > 0 ? [] : findPlacementAttributes(document);

  if (placementAttributes.some(({ profile }) => profile.flow)) {
    placementAttributes.forEach(({ profile, key }) => profile.delete(key));
    return document.toString({ lineWidth: 0 });
  }

  return placementAttributes.reduceRight((text, { key, value }) => removeLines(text, key.range, value?.range ?? key.range), sdl);
}

function findPlacementAttributes(document: Document.Parsed): PlacementAttributes[] {
  const placement = document.getIn(["profiles", "placement"]);

  if (!isMap(placement)) {
    return [];
  }

  return placement.items.flatMap(({ value: profile }) => {
    if (!isMap(profile)) {
      return [];
    }

    const attributes = profile.items.find(({ key }) => isScalar(key) && key.value === "attributes");

    return attributes ? [{ profile, key: attributes.key as Scalar.Parsed, value: attributes.value as ParsedNode | null }] : [];
  });
}

/** Cutting whole source lines keeps every comment, quote and indent outside the removed key exactly as the template author wrote it. */
function removeLines(text: string, [keyStart]: Range, [, valueEnd]: Range): string {
  const firstLineStart = text.lastIndexOf("\n", keyStart) + 1;
  const lastLineEnd = text.indexOf("\n", Math.max(valueEnd - 1, keyStart));

  return text.slice(0, firstLineStart) + (lastLineEnd === -1 ? "" : text.slice(lastLineEnd + 1));
}
