import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeService } from "@src/services/stripe/stripe.service";
import { AddPaymentMethodPopup } from "./AddPaymentMethodPopup";

import { render } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("AddPaymentMethodPopup", () => {
  it("leaves Stripe unloaded until a setup intent exists", () => {
    const { stripeService } = setup({ clientSecret: undefined });

    expect(stripeService.getStripe).not.toHaveBeenCalled();
  });

  it("loads Stripe once a setup intent exists", () => {
    const { stripeService } = setup({ clientSecret: "seti_secret" });

    expect(stripeService.getStripe).toHaveBeenCalledOnce();
  });

  function setup(input: { clientSecret?: string }) {
    const stripeService = mock<StripeService>({ getStripe: vi.fn().mockReturnValue(new Promise(() => {})) });

    render(
      <TestContainerProvider services={{ stripeService: () => stripeService }}>
        <AddPaymentMethodPopup open={false} onClose={vi.fn()} clientSecret={input.clientSecret} isDarkMode={false} onSuccess={vi.fn()} />
      </TestContainerProvider>
    );

    return { stripeService };
  }
});
