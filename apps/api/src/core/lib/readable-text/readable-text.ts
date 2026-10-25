import type { z } from "@hono/zod-openapi";

/** Spelled as code point ranges rather than Unicode properties because its OpenAPI `pattern` is compiled without the `u` flag. */
// eslint-disable-next-line no-control-regex
const WITHOUT_CONTROL_CHARACTERS = /^[^\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]*$/;

/** Spelled as code point ranges rather than Unicode properties because its OpenAPI `pattern` is compiled without the `u` flag. */
const WITHOUT_CONTROL_CHARACTERS_BUT_LINE_BREAKS_AND_TABS =
  // eslint-disable-next-line no-control-regex
  /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]*$/;

const VISIBLE_CHARACTER = /[^\s\p{Cf}\p{Default_Ignorable_Code_Point}\u2800]/u;

export function readableName(schema: z.ZodString): z.ZodString {
  return schema
    .regex(WITHOUT_CONTROL_CHARACTERS, "The name cannot contain control characters")
    .regex(VISIBLE_CHARACTER, "The name needs at least one visible character");
}

export function readableText(schema: z.ZodString): z.ZodString {
  return schema.regex(WITHOUT_CONTROL_CHARACTERS_BUT_LINE_BREAKS_AND_TABS, "The text cannot contain control characters other than line breaks and tabs");
}
