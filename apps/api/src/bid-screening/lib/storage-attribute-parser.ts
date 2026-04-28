import type { ResourceAttribute } from "../types/inventory.types";

export type StorageClassification = "ephemeral" | "ram" | "persistent";

export interface ParsedStorageAttributes {
  persistent: boolean;
  class: string;
  classification: StorageClassification;
}

export function parseStorageAttributes(attributes: ResourceAttribute[]): ParsedStorageAttributes {
  let persistent = false;
  let storageClass = "";

  for (const attr of attributes) {
    if (attr.key === "persistent") {
      persistent = attr.value === "true";
    } else if (attr.key === "class") {
      storageClass = attr.value.trim();
    }
  }

  if (persistent && storageClass === "ram") {
    throw new Error("Invalid storage configuration: persistent storage cannot use RAM class");
  }

  if (persistent && !storageClass) {
    throw new Error("Persistent storage must specify a valid storage class");
  }

  let classification: StorageClassification;
  if (storageClass === "ram") {
    classification = "ram";
  } else if (persistent) {
    classification = "persistent";
  } else {
    classification = "ephemeral";
  }

  return { persistent, class: storageClass, classification };
}
