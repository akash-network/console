import { z } from "@hono/zod-openapi";

const MAX_ASKED_VALUES = 50;
const MAX_BINDINGS = 20;
const MAX_CHOICES = 50;
const MAX_CHOICE_LENGTH = 200;
const MAX_DEFAULT_LENGTH = 4096;
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const ENV_NAME_PATTERN = /^[-._a-zA-Z][-._a-zA-Z0-9]*$/;

const BindingSchema = z.object({
  service: z.string().min(1),
  env: z.string().regex(ENV_NAME_PATTERN)
});

const commonFields = {
  key: z.string().regex(KEY_PATTERN),
  label: z.string().min(1).max(80),
  help: z.string().max(500).optional(),
  required: z.boolean(),
  bindings: z.array(BindingSchema).min(1).max(MAX_BINDINGS)
};

const defaultField = z.string().max(MAX_DEFAULT_LENGTH).optional();

const TextAskedValueSchema = z
  .object({
    ...commonFields,
    type: z.literal("text"),
    default: defaultField,
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional()
  })
  .strict();

const NumberAskedValueSchema = z
  .object({
    ...commonFields,
    type: z.literal("number"),
    default: defaultField,
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    integer: z.boolean().optional()
  })
  .strict();

const BooleanAskedValueSchema = z
  .object({
    ...commonFields,
    type: z.literal("boolean"),
    default: z.enum(["true", "false"]).optional()
  })
  .strict();

const ChoiceAskedValueSchema = z
  .object({
    ...commonFields,
    type: z.literal("choice"),
    choices: z.array(z.string().max(MAX_CHOICE_LENGTH)).min(1).max(MAX_CHOICES),
    default: defaultField
  })
  .strict();

const SecretAskedValueSchema = z
  .object({
    ...commonFields,
    type: z.literal("secret")
  })
  .strict();

export const AskedValueSchema = z
  .discriminatedUnion("type", [TextAskedValueSchema, NumberAskedValueSchema, BooleanAskedValueSchema, ChoiceAskedValueSchema, SecretAskedValueSchema])
  .openapi("TemplateAskedValue");

export const AskedValuesSchema = z.array(AskedValueSchema).max(MAX_ASKED_VALUES);

export type AskedValue = z.infer<typeof AskedValueSchema>;
export type AskedValueType = AskedValue["type"];
