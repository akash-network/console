import React from "react";
import { describe, expect, it } from "vitest";

import { PublisherName } from "./PublisherName";

import { render, screen } from "@testing-library/react";

describe(PublisherName.name, () => {
  it("shows the name with the initials of its first two words", () => {
    setup({ name: "Lambda Garage Collective" });

    expect(screen.getByText("Lambda Garage Collective")).toBeInTheDocument();
    expect(screen.getByText("LG")).toBeInTheDocument();
  });

  it("uses one initial for a single word and skips punctuation", () => {
    setup({ name: "@tensorpine" });

    expect(screen.getByText("t")).toBeInTheDocument();
  });

  it("keeps a letter outside the basic plane whole", () => {
    setup({ name: "𝔘nicode Études" });

    expect(screen.getByText("𝔘É")).toBeInTheDocument();
  });

  it("shows no initials for a name without letters or digits", () => {
    const { container } = setup({ name: "***" });

    expect(container.querySelector('[aria-hidden="true"]')).toBeEmptyDOMElement();
  });

  it("marks a verified publisher", () => {
    setup({ name: "Lambda Garage", verified: true });

    expect(screen.getByRole("img", { name: "Verified by Akash" })).toHaveAttribute("title", "Verified by Akash");
  });

  it("leaves an unverified publisher unmarked", () => {
    setup({ name: "Lambda Garage", verified: false });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders markup in the name as text", () => {
    const { container } = setup({ name: "<img src=x onerror=alert(1)>" });

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  function setup(input: { name: string; verified?: boolean }) {
    return render(<PublisherName name={input.name} verified={input.verified ?? false} />);
  }
});
