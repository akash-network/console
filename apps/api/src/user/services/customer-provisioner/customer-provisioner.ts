import type { InjectionToken } from "tsyringe";

import type { UserOutput } from "@src/user/repositories";

/**
 * Port owned by the user module for provisioning an external billing customer for a user.
 * The billing module supplies the implementation (see StripeCustomerProvisioner) and registers
 * it against CUSTOMER_PROVISIONER, so the user module never imports billing directly.
 */
export interface CustomerProvisioner {
  provisionCustomer(user: UserOutput): Promise<void>;
}

export const CUSTOMER_PROVISIONER: InjectionToken<CustomerProvisioner> = Symbol("CUSTOMER_PROVISIONER");
