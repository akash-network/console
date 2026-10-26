import { z } from "@hono/zod-openapi";
import type Stripe from "stripe";

export const TAX_ID_TYPES = [
  "eu_vat",
  "gb_vat",
  "ch_vat",
  "no_vat",
  "us_ein",
  "ca_bn",
  "au_abn",
  "nz_gst",
  "in_gst",
  "sg_gst",
  "jp_cn",
  "kr_brn",
  "br_cnpj",
  "mx_rfc",
  "ae_trn",
  "za_vat"
] as const satisfies readonly Stripe.CustomerCreateTaxIdParams.Type[];

/** Next to a company name the legal name prints as an invoice custom field, which Stripe caps at 140 characters. */
const MAX_LEGAL_NAME_LENGTH = 140;
const MAX_COMPANY_NAME_LENGTH = 150;
const MAX_ADDRESS_LINE_LENGTH = 200;
const MAX_POSTAL_CODE_LENGTH = 20;
const MAX_TAX_ID_VALUE_LENGTH = 64;

const optionalAddressField = (maxLength: number) => z.string().trim().max(maxLength).nullable();

const BillingAddressInputSchema = z.object({
  line1: z.string().trim().min(1).max(MAX_ADDRESS_LINE_LENGTH),
  line2: optionalAddressField(MAX_ADDRESS_LINE_LENGTH),
  city: optionalAddressField(MAX_ADDRESS_LINE_LENGTH),
  state: optionalAddressField(MAX_ADDRESS_LINE_LENGTH),
  postalCode: optionalAddressField(MAX_POSTAL_CODE_LENGTH),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .openapi({ description: "Two-letter ISO 3166-1 country code" })
});

const TaxIdInputSchema = z.object({
  type: z.enum(TAX_ID_TYPES).openapi({ description: "Stripe tax ID type, such as eu_vat for an EU VAT number" }),
  value: z.string().trim().min(1).max(MAX_TAX_ID_VALUE_LENGTH)
});

const BillingDetailsInputSchema = z.object({
  legalName: z.string().trim().min(1).max(MAX_LEGAL_NAME_LENGTH).openapi({ description: "The payer's full legal name, printed on invoices" }),
  companyName: z
    .string()
    .trim()
    .min(1)
    .max(MAX_COMPANY_NAME_LENGTH)
    .nullable()
    .optional()
    .openapi({ description: "The company invoices are billed to, with the legal name as its billing contact. Null or omitted bills the legal name" }),
  address: BillingAddressInputSchema,
  taxId: TaxIdInputSchema.nullable()
    .optional()
    .openapi({ description: "Replaces every tax ID on file, removes them all when null, and leaves them untouched when omitted" })
});

const BillingAddressOutputSchema = z.object({
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable()
});

const TaxIdOutputSchema = z.object({
  type: z.string(),
  value: z.string(),
  verificationStatus: z
    .enum(["pending", "verified", "unverified", "unavailable"])
    .nullable()
    .openapi({ description: "Whether the tax authority confirmed the number, or null for a type Stripe does not verify" })
});

const BillingDetailsOutputSchema = z.object({
  legalName: z.string().nullable(),
  companyName: z.string().nullable(),
  address: BillingAddressOutputSchema.nullable(),
  taxId: TaxIdOutputSchema.nullable()
});

export const BillingDetailsResponseSchema = z.object({
  data: BillingDetailsOutputSchema
});

export const UpdateBillingDetailsRequestSchema = z.object({
  data: BillingDetailsInputSchema
});

export type BillingDetailsInput = z.infer<typeof BillingDetailsInputSchema>;
export type BillingDetailsOutput = z.infer<typeof BillingDetailsOutputSchema>;
export type BillingDetailsResponse = z.infer<typeof BillingDetailsResponseSchema>;
export type UpdateBillingDetailsRequest = z.infer<typeof UpdateBillingDetailsRequestSchema>;
