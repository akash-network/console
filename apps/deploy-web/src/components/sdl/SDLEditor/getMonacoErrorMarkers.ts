import type { ValidationError as SchemaValidationError } from "@akashnetwork/chain-sdk/web";
import type { editor, MarkerSeverity } from "monaco-editor";
import type { Document, ParsedNode } from "yaml";

export function getMonacoErrorMarkers(errors: SchemaValidationError[], doc: Document.Parsed, yamlText: string): editor.IMarkerData[] {
  return errors.map(error => {
    const node = findNodeAtPath(doc, error.instancePath);
    const message = formatErrorMessage(error);

    let startPos = { line: 1, column: 1 };
    let endPos = { line: 1, column: 1 };

    if (node?.range) {
      // yaml v2 range is [start, value-end, node-end]
      const [start, , end] = node.range;
      startPos = offsetToLineColumn(yamlText, start);
      endPos = offsetToLineColumn(yamlText, end);
    }

    return {
      severity: 8 satisfies MarkerSeverity.Error,
      message,
      startLineNumber: startPos.line,
      startColumn: startPos.column,
      endLineNumber: endPos.line,
      endColumn: endPos.column
    };
  });
}

function formatErrorMessage(error: SchemaValidationError): string {
  const path = error.instancePath || "(root)";
  const baseMessage = error.message || "Validation error";

  if (error.keyword === "required" && error.params && "missingProperty" in error.params) {
    return `${path}: missing required property '${error.params.missingProperty}'`;
  }

  if (error.keyword === "additionalProperties" && error.params && "additionalProperty" in error.params) {
    return `${path}: unknown property '${error.params.additionalProperty}'`;
  }

  if (error.keyword === "type" && error.params && "type" in error.params) {
    return `${path}: ${baseMessage} (expected ${error.params.type})`;
  }

  return `${path}: ${baseMessage}`;
}

function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const lines = text.slice(0, offset).split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function findNodeAtPath(doc: Document.Parsed, instancePath: string): ParsedNode | null {
  if (!instancePath || instancePath === "") {
    return doc.contents;
  }

  const pathParts = instancePath.split("/").filter(Boolean);
  let current: ParsedNode | null = doc.contents;

  for (const part of pathParts) {
    if (!current) return null;

    // Use duck typing to check node type
    if ("items" in current && Array.isArray(current.items)) {
      const items = current.items;

      // Check if it's a map (items have key property)
      if (items.length > 0 && items[0] && "key" in items[0]) {
        // It's a YAMLMap
        const pair = items.find(item => {
          if (item && "key" in item) {
            const key = item.key as ParsedNode | null;
            const keyValue = key && "value" in key ? key.value : key;
            return keyValue !== null && String(keyValue) === part;
          }
          return false;
        });
        current = pair && "value" in pair ? (pair.value as ParsedNode | null) : null;
      } else {
        // It's a YAMLSeq
        const index = parseInt(part, 10);
        current = (items[index] as ParsedNode | undefined) ?? null;
      }
    } else {
      return null;
    }
  }

  return current;
}
