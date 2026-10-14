import createError from "http-errors";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import type { BillingDetailsInput, BillingDetailsOutput } from "@src/billing/http-schemas/billing-details.schema";
import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { CustomerService } from "@src/billing/services/customer/customer.service";
import type { Payer } from "@src/billing/services/payer/payer";

type TaxIdInput = NonNullable<BillingDetailsInput["taxId"]>;

const NO_BILLING_DETAILS: BillingDetailsOutput = { legalName: null, address: null, taxId: null };

const MAX_STRIPE_PAGE_SIZE = 100;

export const INVALID_TAX_ID_MESSAGE = "This tax ID is not valid for the selected type";

export const INVALID_TAX_ID_ERROR_CODE = "invalid_tax_id";

@singleton()
export class BillingDetailsService {
  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly customerService: CustomerService
  ) {}

  async getBillingDetails(payer: Pick<Payer, "stripeCustomerId">): Promise<BillingDetailsOutput> {
    if (!payer.stripeCustomerId) {
      return NO_BILLING_DETAILS;
    }

    const customer = await this.stripe.customers.retrieve(payer.stripeCustomerId, { expand: ["tax_ids"] });

    if (customer.deleted) {
      return NO_BILLING_DETAILS;
    }

    return toBillingDetails(customer, customer.tax_ids?.data[0]);
  }

  async updateBillingDetails(payer: Payer, input: BillingDetailsInput): Promise<BillingDetailsOutput> {
    const customerId = await this.customerService.getStripeCustomerId(payer);
    const taxId = await this.#replaceTaxIds(customerId, input.taxId);
    const customer = await this.stripe.customers.update(customerId, { name: input.legalName, address: toStripeAddress(input.address) });

    return toBillingDetails(customer, taxId);
  }

  /** Creates the new tax ID before deleting the old ones, so a value Stripe rejects leaves the previous tax ID on file. */
  async #replaceTaxIds(customerId: string, input: TaxIdInput | null): Promise<Stripe.TaxId | undefined> {
    const { data: existing } = await this.stripe.customers.listTaxIds(customerId, { limit: MAX_STRIPE_PAGE_SIZE });
    const current = input
      ? existing.find(taxId => taxId.type === input.type && taxId.value === input.value) ?? (await this.#createTaxId(customerId, input))
      : undefined;
    const replaced = existing.filter(taxId => taxId.id !== current?.id);

    await Promise.all(replaced.map(taxId => this.stripe.customers.deleteTaxId(customerId, taxId.id)));

    return current;
  }

  async #createTaxId(customerId: string, input: TaxIdInput): Promise<Stripe.TaxId> {
    try {
      return await this.stripe.customers.createTaxId(customerId, { type: input.type, value: input.value });
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "tax_id_invalid") {
        throw createError(400, INVALID_TAX_ID_MESSAGE, { errorCode: INVALID_TAX_ID_ERROR_CODE });
      }

      throw error;
    }
  }
}

function toBillingDetails(customer: Stripe.Customer, taxId: Stripe.TaxId | undefined): BillingDetailsOutput {
  return {
    legalName: customer.name ?? null,
    address: customer.address
      ? {
          line1: customer.address.line1,
          line2: customer.address.line2,
          city: customer.address.city,
          state: customer.address.state,
          postalCode: customer.address.postal_code,
          country: customer.address.country
        }
      : null,
    taxId: taxId ? { type: taxId.type, value: taxId.value, verificationStatus: taxId.verification?.status ?? null } : null
  };
}

/** Stripe keeps an address field that an update leaves out, so a cleared field is sent as an empty string. */
function toStripeAddress(address: BillingDetailsInput["address"]): Stripe.AddressParam {
  return {
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postal_code: address.postalCode ?? "",
    country: address.country
  };
}
