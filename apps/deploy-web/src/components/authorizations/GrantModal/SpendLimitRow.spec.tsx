import { describe, expect, it, vi } from "vitest";

import { UAKT_DENOM } from "@src/config/denom.config";
import { DEPENDENCIES, SpendLimitRow } from "./SpendLimitRow";

import { fireEvent, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

describe("SpendLimitRow", () => {
  it("renders FormField for denom when ACT is not supported", () => {
    const FormFieldMock = vi.fn(ComponentMock);
    setup({ dependencies: { FormField: FormFieldMock } });

    const denomField = FormFieldMock.mock.calls.find(c => c[0].name === "spendLimits.0.denom");

    expect(denomField).toBeDefined();
  });

  it("renders FormField for amount", () => {
    const FormFieldMock = vi.fn(ComponentMock);
    setup({ dependencies: { FormField: FormFieldMock } });

    const amountField = FormFieldMock.mock.calls.find(c => c[0].name === "spendLimits.0.amount");

    expect(amountField).toBeDefined();
  });

  it("renders token dropdown with supported tokens when ACT is not supported", () => {
    const SelectItemMock = vi.fn(ComponentMock);
    const FormFieldMock = vi.fn(RenderPropMock);
    setup({ dependencies: { SelectItem: SelectItemMock, FormField: FormFieldMock } });

    const tokenValues = SelectItemMock.mock.calls.map(c => c[0].value);

    expect(tokenValues).toContain(UAKT_DENOM);
    expect(tokenValues).toContain("uusdc");
  });

  it("does not render Select when ACT is supported", () => {
    const SelectMock = vi.fn(ComponentMock);
    const FormFieldMock = vi.fn(RenderPropMock);
    setup({
      dependencies: {
        Select: SelectMock,
        FormField: FormFieldMock,
        useSupportsACT: () => true
      }
    });

    expect(SelectMock).not.toHaveBeenCalled();
  });

  it("resolves usdc denom before calling useDenomData", () => {
    const useDenomData = vi.fn(() => DEFAULT_DENOM_DATA);
    setup({ denom: "usdc", dependencies: { useDenomData } });

    expect(useDenomData).toHaveBeenCalledWith(USDC_TEST_DENOM);
  });

  it("passes denom directly to useDenomData when not usdc", () => {
    const useDenomData = vi.fn(() => DEFAULT_DENOM_DATA);
    setup({ denom: UAKT_DENOM, dependencies: { useDenomData } });

    expect(useDenomData).toHaveBeenCalledWith(UAKT_DENOM);
  });

  it("displays balance and label from denom data", () => {
    const LinkToMock = vi.fn((props: Record<string, unknown>) => <a onClick={props.onClick as React.MouseEventHandler}>{props.children as React.ReactNode}</a>);
    const FormFieldMock = vi.fn(RenderPropMock);
    const FormInputMock = vi.fn(LabelRenderingMock);
    setup({ dependencies: { LinkTo: LinkToMock, FormField: FormFieldMock, FormInput: FormInputMock } });

    expect(screen.getByText(/Balance:/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getAllByText(/AKT/).length).toBeGreaterThanOrEqual(1);
  });

  it("calls clearErrors and field.onChange with max value when balance link is clicked", () => {
    const onChange = vi.fn();
    const clearErrors = vi.fn();
    const FormFieldMock = vi.fn((props: Record<string, unknown>) => {
      const render = props.render as (args: Record<string, unknown>) => React.ReactNode;
      if (render) {
        if ((props.name as string).includes("amount")) {
          return <>{render({ field: { value: "", onChange } })}</>;
        }
        return <>{render({ field: { value: "", onChange: vi.fn() } })}</>;
      }
      return <>{(props as { children?: React.ReactNode }).children}</>;
    });
    const FormInputMock = vi.fn(LabelRenderingMock);
    const LinkToMock = vi.fn((props: Record<string, unknown>) => <a onClick={props.onClick as React.MouseEventHandler}>{props.children as React.ReactNode}</a>);
    setup({
      dependencies: {
        FormField: FormFieldMock,
        FormInput: FormInputMock,
        LinkTo: LinkToMock,
        useFormContext: () => ({ control: {}, clearErrors })
      }
    });

    fireEvent.click(screen.getByText(/Balance:/));

    expect(clearErrors).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(1000);
  });

  it("passes endIcon with remove button to FormInput when isRemovable", () => {
    const FormInputMock = vi.fn(ComponentMock);
    const FormFieldMock = vi.fn(RenderPropMock);
    setup({
      isRemovable: true,
      dependencies: { FormInput: FormInputMock, FormField: FormFieldMock }
    });

    const inputWithEndIcon = FormInputMock.mock.calls.find(c => c[0].endIcon);

    expect(inputWithEndIcon).toBeDefined();
  });

  it("does not pass endIcon to FormInput when not isRemovable", () => {
    const FormInputMock = vi.fn(ComponentMock);
    const FormFieldMock = vi.fn(RenderPropMock);
    setup({
      isRemovable: false,
      dependencies: { FormInput: FormInputMock, FormField: FormFieldMock }
    });

    const inputWithEndIcon = FormInputMock.mock.calls.find(c => c[0].endIcon);

    expect(inputWithEndIcon).toBeUndefined();
  });

  it("calls onRemove when remove button is clicked", () => {
    const FormFieldMock = vi.fn(RenderPropMock);
    const FormInputMock = vi.fn((props: Record<string, unknown>) => <>{props.endIcon as React.ReactNode}</>);
    const onRemove = vi.fn();
    setup({
      isRemovable: true,
      onRemove,
      dependencies: { FormField: FormFieldMock, FormInput: FormInputMock }
    });

    fireEvent.click(screen.getByRole("button"));

    expect(onRemove).toHaveBeenCalled();
  });

  it("displays token label in spending limit label", () => {
    const FormFieldMock = vi.fn(RenderPropMock);
    const FormInputMock = vi.fn(LabelRenderingMock);
    setup({
      denom: UAKT_DENOM,
      dependencies: { FormField: FormFieldMock, FormInput: FormInputMock }
    });

    expect(screen.getByText(/Spending Limit \(AKT\)/)).toBeInTheDocument();
  });

  it("uses correct field name with provided index", () => {
    const FormFieldMock = vi.fn(ComponentMock);
    setup({ index: 2, dependencies: { FormField: FormFieldMock } });

    const amountField = FormFieldMock.mock.calls.find(c => c[0].name === "spendLimits.2.amount");

    expect(amountField).toBeDefined();
  });

  function setup(
    input: {
      index?: number;
      denom?: string;
      isRemovable?: boolean;
      onRemove?: () => void;
      dependencies?: Partial<Record<keyof typeof DEPENDENCIES, unknown>>;
    } = {}
  ) {
    const onRemove = input.onRemove ?? vi.fn();

    render(
      <SpendLimitRow
        index={input.index ?? 0}
        denom={input.denom ?? UAKT_DENOM}
        isRemovable={input.isRemovable ?? false}
        onRemove={onRemove}
        dependencies={
          {
            ...MockComponents(DEPENDENCIES),
            useFormContext: () => ({ control: {}, clearErrors: vi.fn() }),
            useSupportsACT: () => false,
            useSupportedDenoms: () => DEFAULT_SUPPORTED_TOKENS,
            useUsdcDenom: () => USDC_TEST_DENOM,
            useDenomData: () => DEFAULT_DENOM_DATA,
            ...input.dependencies
          } as typeof DEPENDENCIES
        }
      />
    );

    return { onRemove };
  }

  const USDC_TEST_DENOM = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1" as const;

  const DEFAULT_DENOM_DATA = { min: 0, max: 1000, label: "AKT", balance: 500 };

  const DEFAULT_SUPPORTED_TOKENS = [
    { id: UAKT_DENOM, label: "uAKT", tokenLabel: "AKT", value: UAKT_DENOM },
    { id: "uusdc", label: "uUSDC", tokenLabel: "USDC", value: USDC_TEST_DENOM }
  ];

  function LabelRenderingMock(props: Record<string, unknown>) {
    return (
      <>
        {props.label as React.ReactNode}
        {(props as { children?: React.ReactNode }).children}
      </>
    );
  }

  function RenderPropMock(props: Record<string, unknown>) {
    const render = props.render as ((args: Record<string, unknown>) => React.ReactNode) | undefined;
    if (render) {
      return <>{render({ field: { value: "", onChange: vi.fn() } })}</>;
    }
    return <>{(props as { children?: React.ReactNode }).children}</>;
  }
});
