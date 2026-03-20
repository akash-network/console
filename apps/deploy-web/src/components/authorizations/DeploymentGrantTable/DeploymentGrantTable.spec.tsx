import { describe, expect, it, vi } from "vitest";

import type { GrantType } from "@src/types/grant";
import { DEPENDENCIES, DeploymentGrantTable } from "./DeploymentGrantTable";

import { render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

describe(DeploymentGrantTable.name, () => {
  it("calls onEditGrant when edit button is clicked", () => {
    const ButtonMock = vi.fn(ComponentMock);
    const grant = createGrant();
    const { onEditGrant } = setup({
      grants: [grant],
      dependencies: { Button: ButtonMock }
    });

    const editCall = ButtonMock.mock.calls.find(c => c[0]["aria-label"] === "Edit Authorization");
    editCall![0].onClick();

    expect(onEditGrant).toHaveBeenCalledWith(grant);
  });

  it("calls setDeletingGrants with the grant when revoke button is clicked", () => {
    const ButtonMock = vi.fn(ComponentMock);
    const grant = createGrant();
    const { setDeletingGrants } = setup({
      grants: [grant],
      dependencies: { Button: ButtonMock }
    });

    const revokeCall = ButtonMock.mock.calls.find(c => c[0]["aria-label"] === "Revoke Authorization");
    revokeCall![0].onClick();

    expect(setDeletingGrants).toHaveBeenCalledWith([grant]);
  });

  it("adds grant to selection when checkbox is checked", () => {
    const CheckboxMock = vi.fn(ComponentMock);
    const grant = createGrant();
    const { setSelectedGrants } = setup({
      grants: [grant],
      dependencies: { Checkbox: CheckboxMock }
    });

    CheckboxMock.mock.calls[0][0].onCheckedChange(true);

    const updater = setSelectedGrants.mock.calls[0][0];
    expect(updater([])).toEqual([grant]);
  });

  it("removes grant from selection when checkbox is unchecked", () => {
    const CheckboxMock = vi.fn(ComponentMock);
    const grant = createGrant({ grantee: "akash1abc" });
    const { setSelectedGrants } = setup({
      grants: [grant],
      selectedGrants: [grant],
      dependencies: { Checkbox: CheckboxMock }
    });

    CheckboxMock.mock.calls[0][0].onCheckedChange(false);

    const updater = setSelectedGrants.mock.calls[0][0];
    expect(updater([grant])).toEqual([]);
  });

  it("shows 'Revoke all' button when grants exist and none selected", () => {
    setup({ grants: [createGrant()] });

    expect(screen.getByText("Revoke all")).toBeInTheDocument();
  });

  it("calls setDeletingGrants with all grants when 'Revoke all' is clicked", () => {
    const ButtonMock = vi.fn(ComponentMock);
    const grants = [createGrant(), createGrant({ grantee: "akash1def" })];
    const { setDeletingGrants } = setup({
      grants,
      dependencies: { Button: ButtonMock }
    });

    const revokeAllCall = ButtonMock.mock.calls.find(c => c[0].variant === "outline" && c[0].size === "sm");
    revokeAllCall![0].onClick();

    expect(setDeletingGrants).toHaveBeenCalledWith(grants);
  });

  it("shows 'Revoke selected' count when grants are selected", () => {
    const grant = createGrant();
    setup({ grants: [grant], selectedGrants: [grant] });

    expect(screen.getByText(/Revoke selected/)).toBeInTheDocument();
  });

  it("calls setDeletingGrants with selected grants when 'Revoke selected' is clicked", () => {
    const ButtonMock = vi.fn(ComponentMock);
    const grant = createGrant();
    const { setDeletingGrants } = setup({
      grants: [grant],
      selectedGrants: [grant],
      dependencies: { Button: ButtonMock }
    });

    const revokeSelectedCall = ButtonMock.mock.calls.find(c => c[0].variant === "outline" && c[0].size === "sm");
    revokeSelectedCall![0].onClick();

    expect(setDeletingGrants).toHaveBeenCalledWith([grant]);
  });

  it("clears selection when 'Clear' link is clicked", () => {
    const LinkToMock = vi.fn(ComponentMock);
    const grant = createGrant();
    const { setSelectedGrants } = setup({
      grants: [grant],
      selectedGrants: [grant],
      dependencies: { LinkTo: LinkToMock }
    });

    LinkToMock.mock.calls[0][0].onClick();

    expect(setSelectedGrants).toHaveBeenCalledWith([]);
  });

  function setup(
    input: {
      grants?: GrantType[];
      selectedGrants?: GrantType[];
      totalCount?: number;
      pageIndex?: number;
      pageSize?: number;
      dependencies?: Partial<Record<keyof typeof DEPENDENCIES, unknown>>;
    } = {}
  ) {
    const onEditGrant = vi.fn();
    const setDeletingGrants = vi.fn();
    const setSelectedGrants = vi.fn();
    const onPageChange = vi.fn();
    const grants = input.grants || [];
    const selectedGrants = input.selectedGrants || [];

    render(
      <DeploymentGrantTable
        grants={grants}
        selectedGrants={selectedGrants}
        totalCount={input.totalCount ?? grants.length}
        onEditGrant={onEditGrant}
        setDeletingGrants={setDeletingGrants}
        setSelectedGrants={setSelectedGrants}
        onPageChange={onPageChange}
        pageIndex={input.pageIndex ?? 0}
        pageSize={input.pageSize ?? 10}
        dependencies={
          {
            ...MockComponents(DEPENDENCIES),
            ...input.dependencies
          } as typeof DEPENDENCIES
        }
      />
    );

    return { onEditGrant, setDeletingGrants, setSelectedGrants, onPageChange };
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
    };
  }
});
