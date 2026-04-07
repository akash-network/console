import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { GrantType } from "@src/types/grant";
import { DEPENDENCIES, GrantModal } from "./GrantModal";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("disables grantee address field when editing a grant", () => {
    const FormInputMock = vi.fn(ComponentMock);
    const FormFieldMock = vi.fn((props: Record<string, unknown>) => {
      const render = props.render as (args: Record<string, unknown>) => React.ReactNode;
      return <>{render({ field: { value: "", onChange: vi.fn() } })}</>;
    });
    setup({
      editingGrant: createGrant({ grantee: "akash1editgrantee" }),
      dependencies: { FormField: FormFieldMock, FormInput: FormInputMock }
    });

    const granteeCall = FormInputMock.mock.calls.find(c => c[0].label === "Grantee Address");

    expect(granteeCall![0].disabled).toBe(true);
  });

  it("does not disable grantee address field when creating a new grant", () => {
    const FormInputMock = vi.fn(ComponentMock);
    const FormFieldMock = vi.fn((props: Record<string, unknown>) => {
      const render = props.render as (args: Record<string, unknown>) => React.ReactNode;
      return <>{render({ field: { value: "", onChange: vi.fn() } })}</>;
    });
    setup({
      dependencies: { FormField: FormFieldMock, FormInput: FormInputMock }
    });

    const granteeCall = FormInputMock.mock.calls.find(c => c[0].label === "Grantee Address");

    expect(granteeCall![0].disabled).toBe(false);
  });

  it("submits grant transaction and calls onClose on success", async () => {
    const { signAndBroadcastTx, onClose, analyticsService } = setup({
      editingGrant: createGrant({ grantee: "akash1grantee" })
    });
    signAndBroadcastTx.mockResolvedValue({ transactionHash: "abc123" });

    const form = document.querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(signAndBroadcastTx).toHaveBeenCalled();
    });

    expect(analyticsService.track).toHaveBeenCalledWith("authorize_spend", {
      category: "deployments",
      label: "Authorize wallet to spend on deployment deposits"
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when transaction fails", async () => {
    const { signAndBroadcastTx, onClose } = setup({
      editingGrant: createGrant({ grantee: "akash1grantee" })
    });
    signAndBroadcastTx.mockResolvedValue(undefined);

    const form = document.querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(signAndBroadcastTx).toHaveBeenCalled();
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("sends spend limit as array when ACT is supported", async () => {
    const { signAndBroadcastTx } = setup({
      editingGrant: createGrant({ grantee: "akash1grantee" }),
      dependencies: {
        useSupportedDenoms: () => ACT_SUPPORTED_TOKENS
      }
    });
    signAndBroadcastTx.mockResolvedValue({ transactionHash: "abc123" });

    const form = document.querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(signAndBroadcastTx).toHaveBeenCalled();
    });

    const message = signAndBroadcastTx.mock.calls[0][0][0];
    expect(message).toBeDefined();
  });

  it("triggers form submit when Grant button is clicked", async () => {
    const PopupMock = vi.fn(ComponentMock);
    const { signAndBroadcastTx } = setup({
      editingGrant: createGrant({ grantee: "akash1grantee" }),
      dependencies: { Popup: PopupMock }
    });
    signAndBroadcastTx.mockResolvedValue({ transactionHash: "abc123" });

    const grantAction = PopupMock.mock.calls[0][0].actions.find((a: { label: string }) => a.label === "Grant");
    grantAction.onClick({ preventDefault: vi.fn() } as unknown as React.MouseEvent);

    await waitFor(() => {
      expect(signAndBroadcastTx).toHaveBeenCalled();
    });
  });

  it("renders info alert about authorized spend", () => {
    const AlertMock = vi.fn(ComponentMock);
    setup({ dependencies: { Alert: AlertMock } });

    expect(AlertMock).toHaveBeenCalled();
  });

  it("renders authorized spend doc link with click handler", () => {
    const LinkToMock = vi.fn(ComponentMock);
    setup({ dependencies: { LinkTo: LinkToMock } });

    const docLinkCall = LinkToMock.mock.calls.find(c => {
      const children = c[0].children;
      return typeof children === "string" && children === "Authorized Spend";
    });

    expect(docLinkCall).toBeDefined();
    expect(docLinkCall![0].onClick).toBeDefined();
  });

  it("renders expiration field", () => {
    const FormFieldMock = vi.fn(ComponentMock);
    setup({ dependencies: { FormField: FormFieldMock } });

    const expirationField = FormFieldMock.mock.calls.find(c => c[0].name === "expiration");

    expect(expirationField).toBeDefined();
  });

  it("shows 'Add AKT Grant' button when only one row exists", () => {
    const ButtonMock = vi.fn(ComponentMock);
    setup({
      dependencies: {
        Button: ButtonMock,
        useSupportedDenoms: () => ACT_SUPPORTED_TOKENS
      }
    });

    const addButton = ButtonMock.mock.calls.find(c => c[0].children === "Add AKT Grant");

    expect(addButton).toBeDefined();
  });

  it("adds second SpendLimitRow when 'Add AKT Grant' button is clicked", () => {
    const ButtonMock = vi.fn((props: Record<string, unknown>) => (
      <button onClick={props.onClick as React.MouseEventHandler}>{props.children as React.ReactNode}</button>
    ));
    const SpendLimitRowMock = vi.fn(ComponentMock);
    setup({
      dependencies: {
        Button: ButtonMock,
        SpendLimitRow: SpendLimitRowMock,
        useSupportedDenoms: () => ACT_SUPPORTED_TOKENS
      }
    });

    fireEvent.click(screen.getByText("Add AKT Grant"));

    const secondRow = SpendLimitRowMock.mock.calls.find(c => c[0].index === 1);
    expect(secondRow).toBeDefined();
  });

  it("passes isRemovable to both rows when two spend limits exist", () => {
    const SpendLimitRowMock = vi.fn(ComponentMock);
    setup({
      editingGrant: createGrant({
        authorization: {
          "@type": "/akash.escrow.v1.DepositAuthorization",
          spend_limits: [
            { denom: UACT_DENOM, amount: "5000000" },
            { denom: UAKT_DENOM, amount: "3000000" }
          ]
        }
      }),
      dependencies: {
        SpendLimitRow: SpendLimitRowMock,
        useSupportedDenoms: () => ACT_SUPPORTED_TOKENS
      }
    });

    const firstRow = SpendLimitRowMock.mock.calls.find(c => c[0].index === 0);
    const secondRow = SpendLimitRowMock.mock.calls.find(c => c[0].index === 1);
    expect(firstRow![0].isRemovable).toBe(true);
    expect(secondRow![0].isRemovable).toBe(true);
  });

  it("renders SpendLimitRow for each spend limit when editing grant with multiple spend_limits", () => {
    const SpendLimitRowMock = vi.fn(ComponentMock);
    setup({
      editingGrant: createGrant({
        authorization: {
          "@type": "/akash.escrow.v1.DepositAuthorization",
          spend_limits: [
            { denom: UACT_DENOM, amount: "5000000" },
            { denom: UAKT_DENOM, amount: "3000000" }
          ]
        }
      }),
      dependencies: {
        SpendLimitRow: SpendLimitRowMock,
        useSupportedDenoms: () => ACT_SUPPORTED_TOKENS
      }
    });

    const firstRow = SpendLimitRowMock.mock.calls.find(c => c[0].index === 0);
    const secondRow = SpendLimitRowMock.mock.calls.find(c => c[0].index === 1);

    expect(firstRow).toBeDefined();
    expect(secondRow).toBeDefined();
  });

  it("does not show add grant button when both rows exist", () => {
    const ButtonMock = vi.fn(ComponentMock);
    setup({
      editingGrant: createGrant({
        authorization: {
          "@type": "/akash.escrow.v1.DepositAuthorization",
          spend_limits: [
            { denom: UACT_DENOM, amount: "5000000" },
            { denom: UAKT_DENOM, amount: "3000000" }
          ]
        }
      }),
      dependencies: {
        Button: ButtonMock,
        useSupportedDenoms: () => ACT_SUPPORTED_TOKENS
      }
    });

    const addButton = ButtonMock.mock.calls.find(c => c[0].children === "Add AKT Grant");

    expect(addButton).toBeUndefined();
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
            useUsdcDenom: () => USDC_TEST_DENOM,
            useDenomData: () => ({ min: 0, max: 1000, label: "AKT", balance: 500 }),
            useSupportedDenoms: () => DEFAULT_SUPPORTED_TOKENS,
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
        "@type": "/akash.escrow.v1.DepositAuthorization",
        spend_limits: [
          {
            denom: "uakt",
            amount: "1000000"
          }
        ]
      },
      ...overrides
    } as GrantType;
  }

  const USDC_TEST_DENOM = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1" as const;

  const DEFAULT_SUPPORTED_TOKENS = [
    { id: UAKT_DENOM, label: "uAKT", tokenLabel: "AKT", value: UAKT_DENOM },
    { id: "uusdc", label: "uUSDC", tokenLabel: "USDC", value: USDC_TEST_DENOM }
  ];

  const ACT_SUPPORTED_TOKENS = [
    { id: UACT_DENOM, label: "uACT", tokenLabel: "ACT", value: UACT_DENOM },
    { id: UAKT_DENOM, label: "uAKT", tokenLabel: "AKT", value: UAKT_DENOM }
  ];
});
