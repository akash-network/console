import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import type { z, ZodTypeAny } from "zod";

/**
 * Safely generates mock data from a Zod schema, handling the RangeError issue
 * that occurs when @anatine/zod-mock tries to generate strings with min constraints
 * but no max constraints.
 */
export function generateSafeMock<T extends ZodTypeAny>(zodRef: T): z.infer<typeof zodRef> {
  try {
    return generateMock(zodRef);
  } catch (error) {
    if (error instanceof RangeError && error.message.includes("Invalid array length")) {
      console.warn("Caught RangeError in generateMock, using fallback generator");
      return generateFallbackMock(zodRef);
    }
    throw error;
  }
}

/**
 * Fallback mock generator that uses safe string lengths to avoid RangeError
 */
function generateFallbackMock<T extends ZodTypeAny>(schema: T): z.infer<typeof schema> {
  if (schema._def?.typeName === "ZodString") {
    const minLength = schema._def.minLength?.value || 1;
    const maxLength = schema._def.maxLength?.value || minLength + 20;
    const length = Math.max(minLength, Math.min(maxLength, faker.number.int({ min: minLength, max: maxLength })));
    return faker.string.alpha({ length });
  }

  if (schema._def?.typeName === "ZodObject") {
    const result: any = {};
    for (const [key, value] of Object.entries(schema._def.shape())) {
      result[key] = generateFallbackMock(value as ZodTypeAny);
    }
    return result;
  }

  if (schema._def?.typeName === "ZodUnion") {
    const options = schema._def.options;
    const randomOption = options[faker.number.int({ min: 0, max: options.length - 1 })];
    return generateFallbackMock(randomOption);
  }

  if (schema._def?.typeName === "ZodLiteral") {
    return schema._def.value;
  }

  if (schema._def?.typeName === "ZodOptional") {
    if (faker.datatype.boolean()) {
      return generateFallbackMock(schema._def.innerType);
    }
    return undefined;
  }

  if (schema._def?.typeName === "ZodArray") {
    const minItems = schema._def.minLength?.value || 0;
    const maxItems = schema._def.maxLength?.value || minItems + 3;
    const length = faker.number.int({ min: minItems, max: maxItems });
    return Array.from({ length }, () => generateFallbackMock(schema._def.type));
  }

  if (schema._def?.typeName === "ZodBoolean") {
    return faker.datatype.boolean();
  }

  if (schema._def?.typeName === "ZodNumber") {
    return faker.number.int({ min: 1, max: 1000 });
  }

  // Default fallback
  return faker.string.alpha({ length: 10 });
}
