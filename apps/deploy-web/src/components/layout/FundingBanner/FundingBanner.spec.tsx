import { describe, expect, it, vi } from "vitest";

import { type DEPENDENCIES, FundingBanner } from "./FundingBanner";

import { act, fireEvent, render, screen } from "@testing-library/react";

describe(FundingBanner.name, () => {
  it("opens the Add Credits sheet on click and closes it once the purchase completes", () => {
    const { getSheetProps } = setup();
    expect(getSheetProps().open).toBe(false);

    fireEvent.click(screen.getByRole("button"));
    expect(getSheetProps().open).toBe(true);

    act(() => getSheetProps().onDone(50));
    expect(getSheetProps().open).toBe(false);
  });

  function setup() {
    const AddCreditsSheet = vi.fn<typeof DEPENDENCIES.AddCreditsSheet>(() => <></>);

    render(<FundingBanner dependencies={{ AddCreditsSheet }} />);

    return { getSheetProps: () => AddCreditsSheet.mock.calls.at(-1)![0] };
  }
});
