import React from "react";
import { describe, expect, it } from "vitest";

import Markdown from "@src/components/shared/Markdown";
import { rehypeRemoveDeployBadge } from "./rehypeRemoveDeployBadge";

import { render, screen } from "@testing-library/react";

const BADGE_IMAGE = "https://raw.githubusercontent.com/akash-network/console/refs/heads/main/apps/deploy-web/public/images/deploy-with-akash-btn.svg";
const BADGE_LINK = "https://console.akash.network/new-deployment?step=edit-deployment&templateId=akash-network-awesome-akash-comfyui";

describe(rehypeRemoveDeployBadge.name, () => {
  it("removes the linked badge and the paragraph it sat in, keeping the rest of the README", () => {
    const { container } = setup({ readme: `# ComfyUI\n\n[![Deploy on Akash](${BADGE_IMAGE})](${BADGE_LINK})\n\nRun ComfyUI on a GPU.` });

    expect(screen.queryByRole("img", { name: "Deploy on Akash" })).not.toBeInTheDocument();
    expect(container.querySelector(`a[href="${BADGE_LINK}"]`)).not.toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "ComfyUI" })).toBeInTheDocument();
    expect(screen.getByText("Run ComfyUI on a GPU.")).toBeInTheDocument();
  });

  it("removes the badge written as HTML", () => {
    const { container } = setup({
      readme: `<a href="${BADGE_LINK}"><img src="${BADGE_IMAGE}" alt="Deploy on Akash" /></a>\n\nRun ComfyUI on a GPU.`,
      hasHtml: true
    });

    expect(screen.queryByRole("img", { name: "Deploy on Akash" })).not.toBeInTheDocument();
    expect(container.querySelector(`a[href="${BADGE_LINK}"]`)).not.toBeInTheDocument();
  });

  it("removes an HTML wrapper the badge leaves holding only whitespace", () => {
    const { container } = setup({
      readme: `<p align="center">\n  <a href="${BADGE_LINK}">\n    <img src="${BADGE_IMAGE}" alt="Deploy on Akash" />\n  </a>\n</p>\n\nRun ComfyUI on a GPU.`,
      hasHtml: true
    });

    expect(container.querySelector('p[align="center"]')).not.toBeInTheDocument();
    expect(screen.getByText("Run ComfyUI on a GPU.")).toBeInTheDocument();
  });

  it("keeps the text that shares a line with the badge", () => {
    setup({ readme: `# ComfyUI [![Deploy on Akash](${BADGE_IMAGE})](${BADGE_LINK})` });

    expect(screen.getByRole("heading", { name: "ComfyUI" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Deploy on Akash" })).not.toBeInTheDocument();
  });

  it("keeps a link that holds more than the badge", () => {
    setup({ readme: `[Open in Console ![Deploy on Akash](${BADGE_IMAGE})](${BADGE_LINK})` });

    expect(screen.getByRole("link", { name: "Open in Console" })).toHaveAttribute("href", BADGE_LINK);
  });

  it("keeps other images and links", () => {
    setup({
      readme: `[![Build status](https://img.shields.io/badge/build-passing-green.svg)](https://github.com/comfyanonymous/ComfyUI)\n\n![Screenshot](https://example.com/deploy-with-akash-btn.png)`
    });

    expect(screen.getByRole("img", { name: "Build status" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Screenshot" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Build status" })).toBeInTheDocument();
  });

  it("keeps a paragraph that was already empty", () => {
    const { container } = setup({ readme: `<p></p>\n\nRun ComfyUI on a GPU.`, hasHtml: true });

    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  function setup(input: { readme: string; hasHtml?: boolean }) {
    return render(
      <Markdown hasHtml={input.hasHtml} rehypePlugins={[rehypeRemoveDeployBadge]}>
        {input.readme}
      </Markdown>
    );
  }
});
