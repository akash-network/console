import type { z } from "@hono/zod-openapi";

const WITHOUT_CONTROL_CHARACTERS = /^[^\p{Cc}\p{Bidi_Control}]*$/u;

const WITHOUT_CONTROL_CHARACTERS_BUT_LINE_BREAKS_AND_TABS = /^(?:[^\p{Cc}\p{Bidi_Control}]|[\t\n\r])*$/u;

const VISIBLE_CHARACTER = /[^\s\p{Cf}\p{Default_Ignorable_Code_Point}\u2800]/u;

export function readableName(schema: z.ZodString): z.ZodString {
  return schema
    .regex(WITHOUT_CONTROL_CHARACTERS, "The name cannot contain control characters")
    .regex(VISIBLE_CHARACTER, "The name needs at least one visible character");
}

export function readableText(schema: z.ZodString): z.ZodString {
  return schema.regex(WITHOUT_CONTROL_CHARACTERS_BUT_LINE_BREAKS_AND_TABS, "The text cannot contain control characters other than line breaks and tabs");
}
