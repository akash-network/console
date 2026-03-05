import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { ImageRegistryLogo } from "./ImageRegistryLogo";

import { render, screen } from "@testing-library/react";

describe(ImageRegistryLogo.name, () => {
  it("renders docker logo when host is not provided", () => {
    setup({});

    const image = screen.queryByAltText("Registry Logo");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "/images/docker.png");
    expect(image).toHaveAttribute("width", "24");
    expect(image).toHaveAttribute("height", "18");
  });

  it("renders docker logo when host is undefined", () => {
    setup({ host: undefined });

    const image = screen.queryByAltText("Registry Logo");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "/images/docker.png");
    expect(image).toHaveAttribute("height", "18");
  });

  it("renders docker logo when host is not in the images map", () => {
    setup({ host: "unknown-registry.com" });

    const image = screen.queryByAltText("Registry Logo");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "/images/docker.png");
    expect(image).toHaveAttribute("height", "18");
  });

  it("renders docker logo when host is 'docker.io'", () => {
    setup({ host: "docker.io" });

    const image = screen.queryByAltText("Registry Logo");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "/images/docker.png");
    expect(image).toHaveAttribute("width", "24");
    expect(image).toHaveAttribute("height", "18");
  });

  it("renders github logo when host is 'ghcr.io'", () => {
    setup({ host: "ghcr.io" });

    const image = screen.queryByAltText("Registry Logo");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "/images/github.png");
    expect(image).toHaveAttribute("width", "24");
    expect(image).toHaveAttribute("height", "24");
  });

  it("renders gitlab logo when host is 'registry.gitlab.com'", () => {
    setup({ host: "registry.gitlab.com" });

    const image = screen.queryByAltText("Registry Logo");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "/images/gitlab.png");
    expect(image).toHaveAttribute("width", "24");
    expect(image).toHaveAttribute("height", "24");
  });

  function setup(input: Partial<ComponentProps<typeof ImageRegistryLogo>> = {}) {
    return render(
      <ImageRegistryLogo
        {...input}
        dependencies={{
          Image: ({ quality, priority, src, ...props }) => {
            return <img src={String(src)} {...props} />;
          }
        }}
      />
    );
  }
});
