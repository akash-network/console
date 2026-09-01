import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it } from "vitest";

import type { AddCreditsRequest } from "@src/store/addCreditsStore";
import { addCreditsRequestAtom } from "@src/store/addCreditsStore";
import type { DEPENDENCIES } from "./AddCreditsHost";
import { AddCreditsHost } from "./AddCreditsHost";

import { act, render, screen } from "@testing-library/react";

describe("AddCreditsHost", () => {
  it("keeps the sheet closed until something requests credits", () => {
    setup();

    expect(screen.getByTestId("add-credits-sheet")).toHaveAttribute("data-open", "false");
  });

  it("opens the sheet on the requested tab, with the requested description and context", () => {
    const { open } = setup();

    open({ initialTab: "coupon", description: "Redeem your hackathon coupon.", context: "hackathon" });

    const sheet = screen.getByTestId("add-credits-sheet");
    expect(sheet).toHaveAttribute("data-open", "true");
    expect(sheet).toHaveAttribute("data-tab", "coupon");
    expect(sheet).toHaveAttribute("data-context", "hackathon");
    expect(sheet).toHaveTextContent("Redeem your hackathon coupon.");
  });

  it("falls back to the purchase tab and neutral copy for a request that names neither", () => {
    const { open } = setup();

    open({});

    const sheet = screen.getByTestId("add-credits-sheet");
    expect(sheet).toHaveAttribute("data-tab", "purchase");
    expect(sheet).toHaveTextContent("Buy credits or redeem a coupon to top up your balance.");
  });

  it("clears the request when the sheet is dismissed, so the same call site can reopen it", () => {
    const { open, store } = setup();
    open({ context: "review_funding_impact" });

    act(() => screen.getByRole("button", { name: "close" }).click());

    expect(store.get(addCreditsRequestAtom)).toBeNull();
    expect(screen.getByTestId("add-credits-sheet")).toHaveAttribute("data-open", "false");
  });

  it("closes the sheet and celebrates the credited total once a purchase completes", () => {
    const { open, store } = setup();
    open({ context: "review_funding_impact" });

    act(() => screen.getByRole("button", { name: "done" }).click());

    expect(store.get(addCreditsRequestAtom)).toBeNull();
    expect(screen.getByTestId("payment-success")).toHaveTextContent("100+10");
  });

  it("closes the sheet without celebrating when a coupon is redeemed instead", () => {
    const { open, store } = setup();
    open({ initialTab: "coupon" });

    act(() => screen.getByRole("button", { name: "redeemed" }).click());

    expect(store.get(addCreditsRequestAtom)).toBeNull();
    expect(screen.queryByTestId("payment-success")).not.toBeInTheDocument();
  });

  function setup() {
    const store = createStore();
    const AddCreditsSheet: typeof DEPENDENCIES.AddCreditsSheet = ({ open, onOpenChange, onDone, onRedeemed, initialTab, description, context }) => (
      <div data-testid="add-credits-sheet" data-open={open} data-tab={initialTab} data-context={context}>
        {description}
        <button onClick={() => onOpenChange(false)}>close</button>
        <button onClick={() => onDone(100, undefined, 10)}>done</button>
        <button onClick={() => onRedeemed?.()}>redeemed</button>
      </div>
    );
    const PaymentSuccessAnimation: typeof DEPENDENCIES.PaymentSuccessAnimation = ({ show, amount, bonusAmount }) => (
      <>
        {show && (
          <div data-testid="payment-success">
            {amount}+{bonusAmount}
          </div>
        )}
      </>
    );

    render(
      <JotaiProvider store={store}>
        <AddCreditsHost dependencies={{ AddCreditsSheet, PaymentSuccessAnimation }} />
      </JotaiProvider>
    );

    return { store, open: (request: AddCreditsRequest) => act(() => store.set(addCreditsRequestAtom, request)) };
  }
});
