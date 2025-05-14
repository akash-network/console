import type { ZodTypeAny } from "zod";
import { ZodFirstPartyTypeKind } from "zod";

export function toAST(schema: ZodTypeAny): Record<string, any> {
  const def = schema._def;

  const base = {
    label: schema.description || undefined
  };

  switch (def.typeName) {
    case ZodFirstPartyTypeKind.ZodString:
      return { ...base, type: "string" };

    case ZodFirstPartyTypeKind.ZodNumber:
      return { ...base, type: "number" };

    case ZodFirstPartyTypeKind.ZodBoolean:
      return { ...base, type: "boolean" };

    case ZodFirstPartyTypeKind.ZodLiteral:
      return {
        ...base,
        type: "select",
        options: [def.value]
      };

    case ZodFirstPartyTypeKind.ZodOptional:
      return {
        ...toAST(def.innerType),
        optional: true
      };

    case ZodFirstPartyTypeKind.ZodDefault:
      return {
        ...toAST(def.innerType),
        default: def.defaultValue()
      };

    case ZodFirstPartyTypeKind.ZodArray:
      return {
        ...base,
        type: "array",
        items: toAST(def.type)
      };

    case ZodFirstPartyTypeKind.ZodObject: {
      const shape = def.shape();
      const fields: Record<string, any> = {};
      for (const key in shape) {
        fields[key] = toAST(shape[key]);
      }
      return { ...base, type: "object", fields };
    }

    case ZodFirstPartyTypeKind.ZodUnion: {
      const options = def.options as ZodTypeAny[];

      const allAreLiterals = options.every(opt => opt._def.typeName === ZodFirstPartyTypeKind.ZodLiteral);

      if (allAreLiterals) {
        return {
          ...base,
          type: "select",
          options: options.map(opt => opt._def.value)
        };
      }

      return {
        ...base,
        type: "union",
        options: options.map(toAST)
      };
    }

    case ZodFirstPartyTypeKind.ZodDiscriminatedUnion: {
      const options = Array.from((def.options as Map<string, ZodTypeAny>).values());

      const mapping: Record<string, any> = {};
      const typeOptions: string[] = [];

      for (const schema of options) {
        const subAST = toAST(schema);
        const shape = (schema._def as any).shape?.();

        const typeField = shape?.type;
        const typeValue = typeField?._def?.value;

        if (typeof typeValue === "string") {
          mapping[typeValue] = subAST;
          typeOptions.push(typeValue);
        } else {
          console.warn("DiscriminatedUnion: skipping invalid type field", typeField);
        }
      }

      return {
        ...base,
        type: "discriminatedUnion",
        discriminator: def.discriminator,
        select: {
          type: "select",
          discriminator: true,
          options: typeOptions
        },
        mapping
      };
    }

    case ZodFirstPartyTypeKind.ZodIntersection: {
      const left = toAST(def.left);
      const right = toAST(def.right);

      if (left.type === "object" && right.type === "discriminatedUnion") {
        return {
          type: "form",
          fields: left.fields,
          discriminator: right
        };
      }

      return {
        type: "intersection",
        left,
        right
      };
    }

    default:
      return { ...base, type: def.typeName };
  }
}
