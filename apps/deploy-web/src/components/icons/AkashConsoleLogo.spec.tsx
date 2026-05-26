import { describe, expect, it } from "vitest";

import { AkashConsoleLogo } from "./AkashConsoleLogo";

import { render } from "@testing-library/react";

describe(AkashConsoleLogo.name, () => {
  it("renders an svg wordmark sized to the provided dimensions", () => {
    const { container } = render(<AkashConsoleLogo size={{ width: 291, height: 32 }} />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe("291px");
    expect(wrapper.style.height).toBe("32px");
    expect(wrapper.querySelector("svg")).not.toBeNull();
  });
});
