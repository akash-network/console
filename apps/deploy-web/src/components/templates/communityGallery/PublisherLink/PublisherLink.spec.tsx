import React from "react";
import { describe, expect, it } from "vitest";

import type { LinkedPublisher } from "./PublisherLink";
import { PublisherLink } from "./PublisherLink";

import { render, screen } from "@testing-library/react";

describe(PublisherLink.name, () => {
  it("links the publisher's name to its page", () => {
    setup({ name: "Lambda Garage", handle: "lambda-garage" });

    expect(screen.getByRole("link", { name: "Lambda Garage" })).toHaveAttribute("href", "/template-publishers/lambda-garage");
  });

  it("keeps the verified mark inside the link", () => {
    setup({ name: "Lambda Garage", handle: "lambda-garage", verified: true });

    expect(screen.getByRole("link", { name: "Lambda Garage Verified by Akash" })).toBeInTheDocument();
  });

  it("shows the name as text while the publisher has no page", () => {
    setup({ name: "Lambda Garage", handle: null, verified: true });

    expect(screen.getByText("Lambda Garage")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Verified by Akash" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("passes its class to the link and to the plain name alike", () => {
    const { unmount } = setup({ name: "Lambda Garage", handle: "lambda-garage", className: "text-[15px]" });
    expect(screen.getByRole("link")).toHaveClass("text-[15px]");
    unmount();

    setup({ name: "Lambda Garage", handle: null, className: "text-[15px]" });
    expect(screen.getByText("Lambda Garage").parentElement).toHaveClass("text-[15px]");
  });

  it("keeps a handle with unsafe characters inside the path", () => {
    setup({ name: "Odd", handle: "../admin?x=1#y" });

    expect(screen.getByRole("link", { name: "Odd" })).toHaveAttribute("href", "/template-publishers/..%2Fadmin%3Fx%3D1%23y");
  });

  it("renders markup in the name as text", () => {
    const { container } = setup({ name: "<img src=x onerror=alert(1)>", handle: "x" });

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  function setup(input: Partial<LinkedPublisher> & { className?: string }) {
    const { className, ...publisher } = input;

    return render(<PublisherLink publisher={{ name: "Northwind Labs", handle: "northwind-labs", verified: false, ...publisher }} className={className} />);
  }
});
