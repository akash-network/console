import { describe, expect, it } from "vitest";

import { RemovedTemplateNotice } from "./RemovedTemplateNotice";

import { render, screen } from "@testing-library/react";

describe(RemovedTemplateNotice.name, () => {
  it("says the template was removed and names it", () => {
    setup({ title: "Open WebUI + vLLM" });

    expect(screen.getByRole("heading", { name: "This template was removed" })).toBeInTheDocument();
    expect(screen.getByText("Open WebUI + vLLM")).toBeInTheDocument();
    expect(screen.getByText(/Deployments already made from it keep running/)).toBeInTheDocument();
  });

  it("stays calm without a title", () => {
    setup({ title: undefined });

    expect(screen.getByRole("region", { name: "This template was removed" }).querySelectorAll("p")).toHaveLength(1);
  });

  it("links back to the gallery and to My templates for someone signed in", () => {
    setup({ title: "Open WebUI + vLLM" });

    expect(screen.getByRole("link", { name: "Browse templates" })).toHaveAttribute("href", "/templates");
    expect(screen.getByRole("link", { name: "My templates" })).toHaveAttribute("href", "/templates/mine");
  });

  it("offers a signed-out visitor the gallery only", () => {
    setup({ title: "Open WebUI + vLLM", isSignedIn: false });

    expect(screen.getByRole("link", { name: "Browse templates" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My templates" })).not.toBeInTheDocument();
  });

  it("shows markup in the title as text", () => {
    const hostileTitle = '<img src=x onerror="alert(1)"><a href="javascript:alert(1)">[click](javascript:alert(1))</a>';
    const { container } = setup({ title: hostileTitle });

    expect(screen.getByText(hostileTitle)).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/templates", "/templates/mine"]);
  });

  function setup(input: { title: string | undefined; isSignedIn?: boolean }) {
    return render(<RemovedTemplateNotice title={input.title} isSignedIn={input.isSignedIn ?? true} />);
  }
});
