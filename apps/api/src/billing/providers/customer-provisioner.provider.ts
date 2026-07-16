import { container } from "tsyringe";

import { StripeCustomerProvisioner } from "@src/billing/services/customer-provisioner/stripe-customer-provisioner.service";
import { CUSTOMER_PROVISIONER } from "@src/user/services/customer-provisioner/customer-provisioner";

container.register(CUSTOMER_PROVISIONER, { useToken: StripeCustomerProvisioner });
