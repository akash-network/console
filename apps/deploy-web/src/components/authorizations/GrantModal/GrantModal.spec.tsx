import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { GrantType } from "@src/types/grant";
import { DEPENDENCIES, GrantModal } from "./GrantModal";

import { render } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

describe(GrantModal.name, () => {
  it("renders Popup with 'Authorize Spending' title", () => {
    const PopupMock = vi.fn(ComponentMock);
    setup({ dependencies: { Popup: PopupMock } });

    expect(PopupMock.mock.calls[0][0].title).toBe("Authorize Spending");
  });

  it("calls onClose when cancel action is clicked", () => {
    const PopupMock = vi.fn(ComponentMock);
    const { onClose } = setup({ dependencies: { Popup: PopupMock } });

    const cancelAction = PopupMock.mock.calls[0][0].actions.find((a: { label: string }) => a.label === "Cancel");
    cancelAction.onClick();

    expect(onClose).toHaveBeenCalled();
  });

  it("disables Grant button when amount is 0", () => {
    const PopupMock = vi.fn(ComponentMock);
    setup({ dependencies: { Popup: PopupMock } });

    const grantAction = PopupMock.mock.calls[0][0].actions.find((a: { label: string }) => a.label === "Grant");

    expect(grantAction.disabled).toBe(true);
  });

  it("calls onClose when Popup onClose fires", () => {
    const PopupMock = vi.fn(ComponentMock);
    const { onClose } = setup({ dependencies: { Popup: PopupMock } });

    PopupMock.mock.calls[0][0].onClose();

    expect(onClose).toHaveBeenCalled();
  });

  it("renders Popup as open", () => {
    const PopupMock = vi.fn(ComponentMock);
    setup({ dependencies: { Popup: PopupMock } });

    expect(PopupMock.mock.calls[0][0].open).toBe(true);
  });

  it("sets grantee address field to editing grant's grantee", () => {
    const FormFieldMock = vi.fn(ComponentMock);
    setup({
      editingGrant: createGrant({ grantee: "akash1editgrantee" }),
      dependencies: { FormField: FormFieldMock }
    });

    const granteeField = FormFieldMock.mock.calls.find(c => c[0].name === "granteeAddress");

    expect(granteeField).toBeDefined();
  });

  it("sets token field for the form", () => {
    const FormFieldMock = vi.fn(ComponentMock);
    setup({ dependencies: { FormField: FormFieldMock } });

    const tokenField = FormFieldMock.mock.calls.find(c => c[0].name === "token");

    expect(tokenField).toBeDefined();
  });

  function setup(
    input: {
      address?: string;
      editingGrant?: GrantType | null;
      dependencies?: Partial<Record<keyof typeof DEPENDENCIES, unknown>>;
    } = {}
  ) {
    const onClose = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const signAndBroadcastTx = vi.fn();

    render(
      <GrantModal
        address={input.address ?? "akash1testaddress"}
        editingGrant={input.editingGrant}
        onClose={onClose}
        dependencies={
          {
            ...MockComponents(DEPENDENCIES),
            useServices: () => ({ analyticsService }) as unknown as ReturnType<typeof DEPENDENCIES.useServices>,
            useWallet: () => ({ signAndBroadcastTx }) as unknown as ReturnType<typeof DEPENDENCIES.useWallet>,
            useUsdcDenom: () => "ibc/usdc-test-denom",
            useDenomData: () => ({ min: 0, max: 1000, label: "AKT", balance: 500 }),
            useSupportsACT: () => false,
            ...input.dependencies
          } as typeof DEPENDENCIES
        }
      />
    );

    return { onClose, analyticsService, signAndBroadcastTx };
  }

  function createGrant(overrides?: Partial<GrantType>): GrantType {
    return {
      granter: "akash1granter",
      grantee: "akash1grantee",
      expiration: "2025-12-31T00:00:00Z",
      authorization: {
        "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization",
        spend_limit: {
          denom: "uakt",
          amount: "1000000"
        }
      },
      ...overrides
    };
  }
});
