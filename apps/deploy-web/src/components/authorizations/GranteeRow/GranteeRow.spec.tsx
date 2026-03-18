import { describe, expect, it, vi } from "vitest";

import type { GrantType } from "@src/types/grant";
import { DEPENDENCIES, GranteeRow } from "./GranteeRow";

import { render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

describe(GranteeRow.name, () => {
  it("renders granter address", () => {
    const AddressMock = vi.fn(ComponentMock);
    setup({ dependencies: { Address: AddressMock } });

    expect(AddressMock).toHaveBeenCalledWith(expect.objectContaining({ address: "akash1granter", isCopyable: true }), expect.anything());
  });

  it("renders spend limits when present", () => {
    const DenomAmountMock = vi.fn(ComponentMock);
    setup({
      grant: createGrant({
        authorization: {
          "@type": "/akash.escrow.v1.DepositAuthorization",
          spend_limits: [
            { denom: "uakt", amount: "1000000" },
            { denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1", amount: "5000000" }
          ]
        }
      }),
      dependencies: { DenomAmount: DenomAmountMock }
    });

    expect(DenomAmountMock).toHaveBeenCalledTimes(2);
    expect(DenomAmountMock).toHaveBeenCalledWith(expect.objectContaining({ denom: "uakt" }), expect.anything());
    expect(DenomAmountMock).toHaveBeenCalledWith(
      expect.objectContaining({ denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1" }),
      expect.anything()
    );
  });

  it("renders 'Unlimited' when spend_limits is undefined", () => {
    setup({
      grant: createGrant({
        authorization: {
          "@type": "/akash.escrow.v1.DepositAuthorization",
          spend_limits: undefined as never
        }
      })
    });

    expect(screen.getByText("Unlimited")).toBeInTheDocument();
  });

  it("renders expiration date", () => {
    const FormattedTimeMock = vi.fn(ComponentMock);
    const expiration = "2025-12-31T00:00:00Z";
    setup({
      grant: createGrant({ expiration }),
      dependencies: { FormattedTime: FormattedTimeMock }
    });

    expect(FormattedTimeMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: expiration, year: "numeric", month: "numeric", day: "numeric" }),
      expect.anything()
    );
  });

  function setup(input: { grant?: GrantType; dependencies?: Partial<Record<keyof typeof DEPENDENCIES, unknown>> } = {}) {
    const grant = input.grant || createGrant();

    render(
      <GranteeRow
        grant={grant}
        dependencies={
          {
            ...MockComponents(DEPENDENCIES),
            ...input.dependencies
          } as typeof DEPENDENCIES
        }
      />
    );

    return { grant };
  }

  function createGrant(overrides?: Partial<GrantType>): GrantType {
    return {
      granter: "akash1granter",
      grantee: "akash1grantee",
      expiration: "2025-12-31T00:00:00Z",
      authorization: {
        "@type": "/akash.escrow.v1.DepositAuthorization",
        spend_limits: [{ denom: "uakt", amount: "1000000" }]
      },
      ...overrides
    };
  }
});
