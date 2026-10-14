import { describe, expect, it } from "vitest";

import { ProjectGlyph } from "./ProjectGlyph";

import { render } from "@testing-library/react";

describe(ProjectGlyph.name, () => {
  it("shows the project's first letter in a square sized to the request, hidden from assistive tech", () => {
    const { container } = render(<ProjectGlyph name="storefront" size={50} />);

    const glyph = container.firstElementChild as HTMLElement;
    expect(glyph).toHaveTextContent("S");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(glyph.style.width).toBe("50px");
    expect(glyph.style.borderRadius).toBe("13px");
    expect(glyph.style.fontSize).toBe("22px");
  });

  it("falls back to a question mark for a nameless project", () => {
    const { container } = render(<ProjectGlyph name="" />);

    expect(container.firstElementChild).toHaveTextContent("?");
  });
});
