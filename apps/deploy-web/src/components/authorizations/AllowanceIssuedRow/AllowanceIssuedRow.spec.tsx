import { describe, expect, it, vi } from "vitest";

import type { AllowanceType } from "@src/types/grant";
import { AllowanceIssuedRow, DEPENDENCIES } from "./AllowanceIssuedRow";

import { render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

describe(AllowanceIssuedRow.name, () => {
  it("renders grantee address", () => {
    const AddressMock = vi.fn(ComponentMock);
    setup({ dependencies: { Address: AddressMock } });

    expect(AddressMock).toHaveBeenCalledWith(expect.objectContaining({ address: "akash1grantee", isCopyable: true }), expect.anything());
  });

  it("renders spend limit when present", () => {
    const DenomAmountMock = vi.fn(ComponentMock);
    setup({ dependencies: { DenomAmount: DenomAmountMock } });

    expect(DenomAmountMock).toHaveBeenCalledWith(expect.objectContaining({ denom: "uakt" }), expect.anything());
  });

  it("renders 'Unlimited' when spend_limit is empty", () => {
    setup({
      allowance: createAllowance({
        allowance: {
          "@type": "/cosmos.feegrant.v1beta1.BasicAllowance",
          expiration: "2025-12-31T00:00:00Z",
          spend_limit: []
        }
      })
    });

    expect(screen.getByText("Unlimited")).toBeInTheDocument();
  });

  it("renders expiration date", () => {
    const FormattedTimeMock = vi.fn(ComponentMock);
    const expiration = "2025-12-31T00:00:00Z";
    setup({
      allowance: createAllowance({
        allowance: {
          "@type": "/cosmos.feegrant.v1beta1.BasicAllowance",
          expiration,
          spend_limit: [{ denom: "uakt", amount: "1000000" }]
        }
      }),
      dependencies: { FormattedTime: FormattedTimeMock }
    });

    expect(FormattedTimeMock).toHaveBeenCalledWith(expect.objectContaining({ value: expiration }), expect.anything());
  });

  it("calls onEditAllowance when edit button is clicked", () => {
    const ButtonMock = vi.fn(ComponentMock);
    const allowance = createAllowance();
    const { onEditAllowance } = setup({ allowance, dependencies: { Button: ButtonMock } });

    const editCall = ButtonMock.mock.calls.find(c => c[0]["aria-label"] === "Edit Authorization");
    editCall![0].onClick();

    expect(onEditAllowance).toHaveBeenCalledWith(allowance);
  });

  it("calls setDeletingAllowance when revoke button is clicked", () => {
    const ButtonMock = vi.fn(ComponentMock);
    const allowance = createAllowance();
    const { setDeletingAllowance } = setup({ allowance, dependencies: { Button: ButtonMock } });

    const revokeCall = ButtonMock.mock.calls.find(c => c[0]["aria-label"] === "Revoke Authorization");
    revokeCall![0].onClick();

    expect(setDeletingAllowance).toHaveBeenCalledWith(allowance);
  });

  it("calls onSelectAllowance when checkbox is toggled", () => {
    const CheckboxMock = vi.fn(ComponentMock);
    const allowance = createAllowance();
    const { onSelectAllowance } = setup({ allowance, dependencies: { Checkbox: CheckboxMock } });

    CheckboxMock.mock.calls[0][0].onCheckedChange(true);

    expect(onSelectAllowance).toHaveBeenCalledWith(true, allowance);
  });

  function setup(input: { allowance?: AllowanceType; checked?: boolean; dependencies?: Partial<Record<keyof typeof DEPENDENCIES, unknown>> } = {}) {
    const onEditAllowance = vi.fn();
    const setDeletingAllowance = vi.fn();
    const onSelectAllowance = vi.fn();
    const allowance = input.allowance || createAllowance();

    render(
      <AllowanceIssuedRow
        allowance={allowance}
        checked={input.checked}
        onEditAllowance={onEditAllowance}
        setDeletingAllowance={setDeletingAllowance}
        onSelectAllowance={onSelectAllowance}
        dependencies={
          {
            ...MockComponents(DEPENDENCIES),
            ...input.dependencies
          } as typeof DEPENDENCIES
        }
      />
    );

    return { onEditAllowance, setDeletingAllowance, onSelectAllowance };
  }

  function createAllowance(overrides?: Partial<AllowanceType>): AllowanceType {
    return {
      granter: "akash1granter",
      grantee: "akash1grantee",
      allowance: {
        "@type": "/cosmos.feegrant.v1beta1.BasicAllowance",
        expiration: "2025-12-31T00:00:00Z",
        spend_limit: [{ denom: "uakt", amount: "1000000" }]
      },
      ...overrides
    };
  }
});
