import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Box } from "./placeCoachCard";
import type { TourStep } from "./SpotlightTour";
import { SpotlightTour } from "./SpotlightTour";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const FIRST_CONTROL_BOX = { left: 100, top: 50, width: 80, height: 30 };
const SECOND_CONTROL_BOX = { left: 600, top: 300, width: 120, height: 40 };
const DIM_AROUND_SECOND_CONTROL = "M0 0H1024V768H0ZM604 294H716A10 10 0 0 1 726 304V336A10 10 0 0 1 716 346H604A10 10 0 0 1 594 336V304A10 10 0 0 1 604 294Z";
const DIM_WITHOUT_HOLE = "M0 0H1024V768H0Z";
const COACH_CARD_HEIGHT = 210;

describe(SpotlightTour.name, () => {
  it("shows nothing while closed", () => {
    setup({ isOpen: false });

    expect(document.querySelector("[data-whats-new]")).toBeNull();
  });

  it("explains the first step once its hole reaches the control", async () => {
    setup();

    const card = await screen.findByRole("dialog", { name: "First step" });
    expect(card).toHaveTextContent("What's new · 1 of 2");
    expect(card).toHaveTextContent("What the first control does");
    expect(card).toHaveTextContent("Click the first control");
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("cuts a padded, rounded hole around the control out of the dim", async () => {
    setup();

    await waitFor(() =>
      expect(dimPath()).toBe("M0 0H1024V768H0ZM106 44H174A12 12 0 0 1 186 56V74A12 12 0 0 1 174 86H106A12 12 0 0 1 94 74V56A12 12 0 0 1 106 44Z")
    );
  });

  it("moves focus to the card and describes the step to assistive tech", async () => {
    setup();

    const card = await screen.findByRole("dialog", { name: "First step" });

    expect(card).toHaveFocus();
    expect(card).toHaveAccessibleDescription("What the first control does");
  });

  it("moves focus to the card again on the next step", async () => {
    setup();
    await screen.findByRole("dialog", { name: "First step" });

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("dialog", { name: "Second step" })).toHaveFocus();
  });

  it("leaves focus in an open menu, so the menu the step points into stays open", async () => {
    setup({ isMenuOpen: true });
    screen.getByRole("menuitem", { name: "Menu item" }).focus();

    await screen.findByRole("dialog", { name: "First step" });

    expect(screen.getByRole("menuitem", { name: "Menu item" })).toHaveFocus();
  });

  it("anchors the card on the step's preferred side of the control", async () => {
    setup();

    expect(await screen.findByRole("dialog", { name: "First step" })).toHaveAttribute("data-side", "bottom");
  });

  it("moves between steps with Next and Back", async () => {
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    const secondCard = await screen.findByRole("dialog", { name: "Second step" });
    expect(secondCard).toHaveTextContent("What's new · 2 of 2");
    expect(currentDots(secondCard)).toEqual(["false", "true"]);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("dialog", { name: "First step" })).toBeInTheDocument();
  });

  it("glides the hole over to the next step's control", async () => {
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await wait(40);
    expect(dimPath()).not.toBe(DIM_AROUND_SECOND_CONTROL);

    await waitFor(() => expect(dimPath()).toBe(DIM_AROUND_SECOND_CONTROL));
  });

  it("completes the tour with Done on the last step", async () => {
    const { onEnd } = setup();

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Done" }));

    expect(onEnd).toHaveBeenCalledExactlyOnceWith({ stepId: "second", isCompleted: true });
  });

  it("ends the tour unfinished when it is skipped", async () => {
    const { onEnd } = setup();

    await userEvent.click(await screen.findByRole("button", { name: "Skip tour" }));

    expect(onEnd).toHaveBeenCalledExactlyOnceWith({ stepId: "first", isCompleted: false });
  });

  it("moves between steps with the arrow keys and ends unfinished on Escape", async () => {
    const { onEnd } = setup();
    await screen.findByRole("dialog", { name: "First step" });

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("dialog", { name: "First step" })).toBeInTheDocument();

    await userEvent.keyboard("{ArrowRight}");
    expect(await screen.findByRole("dialog", { name: "Second step" })).toBeInTheDocument();

    await userEvent.keyboard("{ArrowLeft}");
    expect(await screen.findByRole("dialog", { name: "First step" })).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(onEnd).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    expect(onEnd).toHaveBeenCalledExactlyOnceWith({ stepId: "first", isCompleted: false });
  });

  it("completes the tour when the arrow key moves past the last step", async () => {
    const { onEnd } = setup();
    await screen.findByRole("dialog", { name: "First step" });

    await userEvent.keyboard("{ArrowRight}");
    await screen.findByRole("dialog", { name: "Second step" });
    await userEvent.keyboard("{ArrowRight}");

    expect(onEnd).toHaveBeenCalledExactlyOnceWith({ stepId: "second", isCompleted: true });
  });

  it("moves on once the highlighted control is clicked, letting the click through", async () => {
    const { onFirstControlClick } = setup();
    await screen.findByRole("dialog", { name: "First step" });

    await userEvent.click(screen.getByRole("button", { name: "First control" }));

    expect(onFirstControlClick).toHaveBeenCalledOnce();
    expect(await screen.findByRole("dialog", { name: "Second step" })).toBeInTheDocument();
  });

  it("keeps the user on the page when the step only lets them explore its control", async () => {
    const { onFirstControlClick } = setup({ firstStepOnTargetClick: "swallow" });
    await screen.findByRole("dialog", { name: "First step" });

    await userEvent.click(screen.getByRole("button", { name: "First control" }));
    await wait(60);

    expect(onFirstControlClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "First step" })).toBeInTheDocument();
  });

  it("ignores clicks outside the highlighted control", async () => {
    setup();
    await screen.findByRole("dialog", { name: "First step" });

    await userEvent.click(screen.getByRole("button", { name: "Unrelated control" }));
    await wait(60);

    expect(screen.getByRole("dialog", { name: "First step" })).toBeInTheDocument();
  });

  it("steps aside while another dialog is open and comes back once it closes", async () => {
    const { onEnd, rerenderWith } = setup();
    await screen.findByRole("dialog", { name: "First step" });

    rerenderWith({ isOtherDialogOpen: true });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "First step" })).not.toBeInTheDocument());
    await userEvent.keyboard("{Escape}");
    expect(onEnd).not.toHaveBeenCalled();

    rerenderWith({ isOtherDialogOpen: false });
    expect(await screen.findByRole("dialog", { name: "First step" })).toBeInTheDocument();
  });

  it("does not step aside for a dialog that is closing", async () => {
    const { rerenderWith } = setup();
    await screen.findByRole("dialog", { name: "First step" });

    rerenderWith({ isOtherDialogOpen: true, otherDialogState: "closed" });
    await wait(60);

    expect(screen.getByRole("dialog", { name: "First step" })).toBeInTheDocument();
  });

  it("steps aside for an open alert dialog", async () => {
    const { rerenderWith } = setup();
    await screen.findByRole("dialog", { name: "First step" });

    rerenderWith({ isOtherDialogOpen: true, otherDialogRole: "alertdialog" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "First step" })).not.toBeInTheDocument());
  });

  it("brings a missing control on screen once, then points at it", async () => {
    const { prepareFirstStep } = setup({ firstControl: "missing", prepareFirstStep: "shows-the-control" });

    expect(await screen.findByRole("dialog", { name: "First step" })).toBeInTheDocument();
    expect(prepareFirstStep).toHaveBeenCalledOnce();
  });

  it("brings the control back on screen each time it goes missing", async () => {
    const { prepareFirstStep, hideFirstControl } = setup({ firstControl: "missing", prepareFirstStep: "shows-the-control" });
    await screen.findByRole("dialog", { name: "First step" });

    hideFirstControl();

    await waitFor(() => expect(prepareFirstStep).toHaveBeenCalledTimes(2));
  });

  it("tries to bring a control on screen only once while it stays missing", async () => {
    const { prepareFirstStep } = setup({ firstControl: "missing", prepareFirstStep: "does-nothing" });

    await screen.findByRole("dialog", { name: "First step" }, { timeout: 3000 });

    expect(prepareFirstStep).toHaveBeenCalledOnce();
  });

  it("centers the card without a hole when the control never shows up", async () => {
    setup({ firstControl: "missing" });

    const card = await screen.findByRole("dialog", { name: "First step" }, { timeout: 3000 });
    expect(card).toHaveAttribute("data-side", "none");
    expect(card).toHaveStyle({ left: "352px", top: `${(768 - COACH_CARD_HEIGHT) / 2}px`, width: "320px" });
    expect(dimPath()).toBe(DIM_WITHOUT_HOLE);
  });

  it("treats a control with no width as missing", async () => {
    setup({ firstControl: "zero-width" });

    expect(await screen.findByRole("dialog", { name: "First step" }, { timeout: 3000 })).toHaveAttribute("data-side", "none");
  });

  it("drops the hole once the control goes away", async () => {
    const { hideFirstControl } = setup();
    await screen.findByRole("dialog", { name: "First step" });

    hideFirstControl();

    await waitFor(() => expect(dimPath()).toBe(DIM_WITHOUT_HOLE), { timeout: 3000 });
  });

  it("narrows the card to fit a phone screen", async () => {
    setup({ viewportWidth: 300 });

    expect(await screen.findByRole("dialog", { name: "First step" })).toHaveStyle({ width: "284px" });
  });

  it("holds the first hole on the announcement card while it fades, then moves to the control", async () => {
    setup({ origin: { x: 300, y: 200, width: 500, height: 400 } });

    await wait(100);
    expect(screen.queryByRole("dialog", { name: "First step" })).not.toBeInTheDocument();
    expect(dimPath()).toContain("M316 200H784A16 16 0 0 1 800 216V");

    expect(await screen.findByRole("dialog", { name: "First step" })).toBeInTheDocument();
  });

  it("jumps straight to each control when motion is reduced", async () => {
    setup({ prefersReducedMotion: true });

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await wait(40);

    expect(dimPath()).toBe(DIM_AROUND_SECOND_CONTROL);
  });

  it("resizes the dim with the window", async () => {
    setup();
    await screen.findByRole("dialog", { name: "First step" });

    vi.stubGlobal("innerWidth", 800);
    act(() => window.dispatchEvent(new Event("resize")));

    await waitFor(() => expect(dimPath()).toMatch(/^M0 0H800V768H0Z/));
  });

  it("stops listening for keys once closed", async () => {
    const { onEnd, rerenderWith } = setup();
    await screen.findByRole("dialog", { name: "First step" });

    rerenderWith({ isOpen: false });
    await userEvent.keyboard("{Escape}");

    expect(onEnd).not.toHaveBeenCalled();
  });

  function dimPath() {
    return document.querySelector("[data-whats-new] svg path")?.getAttribute("d");
  }

  function currentDots(card: HTMLElement) {
    return Array.from(card.querySelectorAll("[data-current]"), dot => dot.getAttribute("data-current"));
  }

  function wait(milliseconds: number) {
    return act(() => new Promise(resolve => setTimeout(resolve, milliseconds)));
  }

  function setup(
    input: {
      isOpen?: boolean;
      origin?: Box;
      prefersReducedMotion?: boolean;
      viewportWidth?: number;
      isMenuOpen?: boolean;
      firstStepOnTargetClick?: TourStep["onTargetClick"];
      firstControl?: "shown" | "missing" | "zero-width";
      prepareFirstStep?: "shows-the-control" | "does-nothing";
    } = {}
  ) {
    const onEnd = vi.fn();
    const onFirstControlClick = vi.fn();
    let firstControl = input.firstControl ?? "shown";
    const prepareFirstStep = vi.fn(() => {
      if (input.prepareFirstStep === "shows-the-control") firstControl = "shown";
    });
    const hideFirstControl = () => {
      firstControl = "missing";
    };

    const steps: TourStep[] = [
      {
        id: "first",
        title: "First step",
        body: "What the first control does",
        hint: "Click the first control",
        hintIcon: "click",
        placement: "bottom",
        padding: 6,
        radius: 12,
        onTargetClick: input.firstStepOnTargetClick ?? "advance",
        findTarget: () => (firstControl === "missing" ? null : screen.getByRole("button", { name: "First control" })),
        prepare: input.prepareFirstStep ? prepareFirstStep : undefined
      },
      {
        id: "second",
        title: "Second step",
        body: "What the second control does",
        hint: "Hover the second control",
        hintIcon: "hover",
        placement: "top",
        padding: 6,
        radius: 10,
        onTargetClick: "advance",
        findTarget: () => screen.getByRole("button", { name: "Second control" })
      }
    ];

    const firstControlBox = firstControl === "zero-width" ? { ...FIRST_CONTROL_BOX, width: 0 } : FIRST_CONTROL_BOX;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function boxOfControl(this: HTMLElement) {
      const box = this.textContent === "First control" ? firstControlBox : this.textContent === "Second control" ? SECOND_CONTROL_BOX : undefined;
      return mock<DOMRect>(box ?? { left: 0, top: 0, width: 0, height: 0 });
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(COACH_CARD_HEIGHT);
    if (input.viewportWidth) vi.stubGlobal("innerWidth", input.viewportWidth);
    onTestFinished(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    const page = (state: { isOpen: boolean; isOtherDialogOpen: boolean; otherDialogState: string; otherDialogRole: string }) => (
      <>
        <button type="button" onClick={onFirstControlClick}>
          First control
        </button>
        <button type="button">Second control</button>
        <button type="button">Unrelated control</button>
        {input.isMenuOpen && (
          <div role="menu">
            <button type="button" role="menuitem">
              Menu item
            </button>
          </div>
        )}
        {state.isOtherDialogOpen && <div role={state.otherDialogRole} data-state={state.otherDialogState} aria-label="Other dialog" />}
        <SpotlightTour
          steps={steps}
          isOpen={state.isOpen}
          origin={input.origin ?? null}
          onEnd={onEnd}
          dependencies={{ useMediaQuery: () => !!input.prefersReducedMotion }}
        />
      </>
    );
    const initialState = { isOpen: input.isOpen ?? true, isOtherDialogOpen: false, otherDialogState: "open", otherDialogRole: "dialog" };
    const { rerender } = render(page(initialState));

    const rerenderWith = (state: Partial<typeof initialState>) => rerender(page({ ...initialState, ...state }));

    return { onEnd, onFirstControlClick, prepareFirstStep, hideFirstControl, rerenderWith };
  }
});
