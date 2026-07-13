import { describe, expect, it, vi } from "vitest";

import { DeploymentTemplatePickerCard } from "./DeploymentTemplatePickerCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DeploymentTemplatePickerCard.name, () => {
  it("renders chip, title, description and price parts", () => {
    setup({
      chip: "Starter",
      title: "Hello World",
      description: "A simple deployment",
      priceBold: "$1",
      priceRest: "/mo"
    });

    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.getByText("A simple deployment")).toBeInTheDocument();
    expect(screen.getByText("$1")).toBeInTheDocument();
    expect(screen.getByText("/mo")).toBeInTheDocument();
  });

  it("renders the CTA label and hero image", () => {
    setup({ ctaLabel: "Deploy now", heroImageAlt: "starter hero" });

    expect(screen.getByRole("button", { name: /Deploy now/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "starter hero" })).toBeInTheDocument();
  });

  it("shows the recommended badge when recommended is true", () => {
    setup({ recommended: true });

    expect(screen.getByText("Recommended for new users")).toBeInTheDocument();
  });

  it("does not show the recommended badge by default", () => {
    setup();

    expect(screen.queryByText("Recommended for new users")).not.toBeInTheDocument();
  });

  it("calls onDeploy when the CTA is clicked", async () => {
    const onDeploy = vi.fn();
    setup({ ctaLabel: "Deploy now", onDeploy });

    await userEvent.click(screen.getByRole("button", { name: /Deploy now/ }));

    expect(onDeploy).toHaveBeenCalledTimes(1);
  });

  it("disables the CTA when disabled is true", async () => {
    const onDeploy = vi.fn();
    setup({ ctaLabel: "Deploy now", disabled: true, onDeploy });

    const button = screen.getByRole("button", { name: /Deploy now/ });

    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onDeploy).not.toHaveBeenCalled();
  });

  it("renders the noise overlay only when heroNoiseOverlaySrc is provided", () => {
    const { container, rerender } = setup({ heroNoiseOverlaySrc: "/noise.png" });

    const overlay = container.querySelector("[aria-hidden]");
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveStyle({ backgroundImage: "url('/noise.png')" });

    rerender(<DeploymentTemplatePickerCard {...baseProps()} />);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });

  function baseProps(input?: Partial<Parameters<typeof DeploymentTemplatePickerCard>[0]>) {
    return {
      chip: "Starter",
      title: "Hello World",
      description: "A simple deployment",
      priceBold: "$1",
      priceRest: "/mo",
      ctaLabel: "Deploy now",
      heroImageSrc: "/hero.png",
      heroImageAlt: "hero",
      ...input
    };
  }

  function setup(input?: Partial<Parameters<typeof DeploymentTemplatePickerCard>[0]>) {
    return render(<DeploymentTemplatePickerCard {...baseProps(input)} />);
  }
});
