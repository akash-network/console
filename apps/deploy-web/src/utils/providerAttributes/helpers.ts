import { nanoid } from "nanoid";
import type { z } from "zod";

import type {
  ProviderAttributeSchemaDetail,
  ProviderAttributeSchemaDetailValue,
  providerAttributesFormValuesSchema,
  ProviderAttributesSchema
} from "@src/types/providerAttributes";

/**
 * Maps the form values to the attributes that are broadcasted to the network
 * @param data
 * @param providerAttributesSchema
 * @returns
 */
export const mapFormValuesToAttributes = (data: z.infer<typeof providerAttributesFormValuesSchema>, providerAttributesSchema: ProviderAttributesSchema) => {
  const attributes: { key: string; value: string }[] = [];

  Object.keys(data).forEach(key => {
    const value = data[key as keyof typeof data];
    const attribute = providerAttributesSchema[key as keyof ProviderAttributesSchema] as ProviderAttributeSchemaDetail;
    if (attribute && value) {
      switch (attribute.type) {
        case "string":
        case "number":
        case "boolean":
          attributes.push({ key, value: `${value}` });
          break;
        case "option":
          // eslint-disable-next-line no-case-declarations
          const detailValue = value as unknown as ProviderAttributeSchemaDetailValue;
          // eslint-disable-next-line no-case-declarations
          const attributeValue = attribute.values?.find(v => v.key === detailValue.key);
          attributes.push({ key: attribute.key, value: `${attributeValue?.key}` });
          break;
        case "multiple-option":
          // eslint-disable-next-line no-case-declarations
          const values = value as ProviderAttributeSchemaDetailValue[];
          values.forEach(_val => {
            const attributeValue = attribute.values?.find(v => v.key === _val.key);

            if (attributeValue?.key) {
              attributes.push({ key: attributeValue.key, value: `${attributeValue?.value}` });
            }
          });
          break;
        default:
          break;
      }
    }

    if (key === "unknown-attributes") {
      const unknownAttributes = value as { id: string; key: string; value: string }[];
      unknownAttributes.forEach(x => attributes.push({ key: x.key, value: x.value }));
    }
  });

  return attributes;
};

/**
 * Get the list of attributes that are unknown to the schema
 * @param attributes
 * @param providerAttributesSchema
 * @returns
 */
export const getUnknownAttributes = (attributes: { key: string; value: string }[], providerAttributesSchema: ProviderAttributesSchema) => {
  const possibleAttributes = Object.values(providerAttributesSchema)
    .map(x => {
      switch (x.type) {
        case "string":
        case "number":
        case "boolean":
        case "option":
          return x.key;
        case "multiple-option":
          return x.values?.map(v => v.key);
        default:
          return null;
      }
    })
    .filter(x => x)
    .flat();

  const res = attributes.filter(x => !possibleAttributes.includes(x.key)).map(x => ({ id: nanoid(), key: x.key, value: x.value }));

  return res;
};
