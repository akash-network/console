import { describe, expect, it, vi } from "vitest";

import { FairUsePolicyModal } from "./FairUsePolicyModal";

import { fireEvent, render, screen } from "@testing-library/react";

describe(FairUsePolicyModal.name, () => {
  it("lists the prohibited workloads and accepts on the single action", () => {
    const { onAccept } = setup({ isAccepting: false });

    fireEvent.click(screen.getByTestId("fair-use-policy-accept-button"));

    expect(screen.getByText("Crypto miners")).toBeInTheDocument();
    expect(screen.getByText("Anything illegal")).toBeInTheDocument();
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("disables the action while the acceptance is in flight", () => {
    setup({ isAccepting: true });

    expect(screen.getByTestId("fair-use-policy-accept-button")).toBeDisabled();
  });

  function setup(input: { isAccepting: boolean }) {
    const onAccept = vi.fn();
    render(<FairUsePolicyModal onAccept={onAccept} isAccepting={input.isAccepting} />);
    return { onAccept };
  }
});
