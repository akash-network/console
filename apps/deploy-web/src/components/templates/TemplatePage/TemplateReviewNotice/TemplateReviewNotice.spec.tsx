import React from "react";
import { describe, expect, it } from "vitest";

import { TemplateReviewNotice } from "./TemplateReviewNotice";

import { render, screen } from "@testing-library/react";

describe(TemplateReviewNotice.name, () => {
  it("says a community template is not reviewed by Akash, names its publisher and tells the deployer what to check", () => {
    setup({ isOfficial: false, publisherName: "Lambda Garage" });

    expect(screen.getByRole("note")).toHaveTextContent(
      "Not reviewed by Akash. Lambda Garage published this template. Akash runs automated checks on every version, but nobody at Akash has reviewed it. Check the images and the SDL before you deploy, and never paste keys you can't rotate."
    );
  });

  it("names no one when the publisher is unknown", () => {
    setup({ isOfficial: false, publisherName: undefined });

    expect(screen.getByRole("note")).toHaveTextContent("Not reviewed by Akash. A Console user published this template.");
  });

  it("says an Official template is Official instead of the warning", () => {
    setup({ isOfficial: true, publisherName: "Lambda Garage" });

    expect(screen.getByRole("note")).toHaveTextContent(
      "Official template. Akash staff reviewed this template and review each new version before it becomes the current one."
    );
    expect(screen.queryByText(/Not reviewed by Akash/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lambda Garage/)).not.toBeInTheDocument();
  });

  it("renders markup in the publisher name as text", () => {
    const { container } = setup({ isOfficial: false, publisherName: "<img src=x onerror=alert(1)>" });

    expect(screen.getByRole("note")).toHaveTextContent("<img src=x onerror=alert(1)> published this template.");
    expect(container.querySelector("img")).toBeNull();
  });

  function setup(input: { isOfficial: boolean; publisherName: string | undefined }) {
    return render(<TemplateReviewNotice isOfficial={input.isOfficial} publisherName={input.publisherName} />);
  }
});
