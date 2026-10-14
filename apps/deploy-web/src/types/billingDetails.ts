import type { operationDefs } from "@akashnetwork/console-api-types";

export type BillingDetails = operationDefs["getBillingDetails"]["responses"][200]["content"]["application/json"]["data"];

export type BillingDetailsInput = operationDefs["updateBillingDetails"]["requestBody"]["content"]["application/json"]["data"];

export type TaxIdType = NonNullable<BillingDetailsInput["taxId"]>["type"];

export const INVALID_TAX_ID_ERROR_CODE = "invalid_tax_id";
