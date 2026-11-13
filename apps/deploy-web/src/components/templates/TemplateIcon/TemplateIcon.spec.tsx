import { describe, expect, it } from "vitest";

import { TEMPLATE_ICONS, TemplateIcon } from "./TemplateIcon";

import { render } from "@testing-library/react";

describe(TemplateIcon.name, () => {
  it.each([
    ["bot", "lucide-bot"],
    ["message-square", "lucide-message-square"],
    ["gamepad", "lucide-gamepad-2"],
    ["chart", "lucide-chart-line"],
    ["file-text", "lucide-file-text"]
  ])("draws the %s icon", (icon, iconClass) => {
    const { icon: drawn } = setup({ icon });

    expect(drawn).toHaveClass(iconClass);
  });

  it.each([null, "retired-icon"])("falls back to a box for %s", icon => {
    const { icon: drawn } = setup({ icon });

    expect(drawn).toHaveClass("lucide-box");
  });

  it("passes its class name to the icon and hides it from assistive technology", () => {
    const { icon: drawn } = setup({ icon: "rocket", className: "h-4 w-4" });

    expect(drawn).toHaveClass("lucide-rocket", "h-4", "w-4");
    expect(drawn).toHaveAttribute("aria-hidden", "true");
  });

  it("covers every icon the api accepts", () => {
    expect(Object.keys(TEMPLATE_ICONS)).toHaveLength(24);
  });

  function setup(input: { icon: string | null; className?: string }) {
    const { container } = render(<TemplateIcon icon={input.icon} className={input.className} />);
    return { icon: container.querySelector("svg") };
  }
});
