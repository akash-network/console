import { describe, expect, it } from "vitest";

import { AkashLoadingMark } from "./AkashLoadingMark";

import { render, screen } from "@testing-library/react";

describe(AkashLoadingMark.name, () => {
  it("renders the mark sized to the given width, keeping the mark aspect ratio", () => {
    setup({ width: 120 });

    const mark = screen.getByRole("status", { name: /loading/i });
    expect(mark).toHaveAttribute("width", "120");
    expect(mark).toHaveAttribute("height", "105");
  });

  function setup(input?: { width?: number }) {
    return render(<AkashLoadingMark width={input?.width} />);
  }
});
