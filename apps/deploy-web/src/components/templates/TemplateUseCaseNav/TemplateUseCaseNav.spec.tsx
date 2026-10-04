import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { UseCaseFilter } from "../templateGalleryModel";
import { TemplateUseCaseNav } from "./TemplateUseCaseNav";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(TemplateUseCaseNav.name, () => {
  it("lists every filter with its count", () => {
    setup({ selectedCategory: null });

    expect(screen.getByRole("button", { name: "All 12" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI - GPU 9" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retro Arcade 3" })).toBeInTheDocument();
  });

  it("shows a grid for All, the category's icon, and a box for a category it has no icon for", () => {
    setup({ selectedCategory: null });

    expect(screen.getByRole("button", { name: "All 12" }).querySelector("svg")).toHaveClass("lucide-layout-grid");
    expect(screen.getByRole("button", { name: "AI - GPU 9" }).querySelector("svg")).toHaveClass("lucide-sparkles");
    expect(screen.getByRole("button", { name: "Retro Arcade 3" }).querySelector("svg")).toHaveClass("lucide-box");
  });

  it("marks the selected filter as current", () => {
    setup({ selectedCategory: "AI - GPU" });

    expect(screen.getByRole("button", { name: "AI - GPU 9" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "All 12" })).not.toHaveAttribute("aria-current");
  });

  it("marks All as current when no category is selected", () => {
    setup({ selectedCategory: null });

    expect(screen.getByRole("button", { name: "All 12" })).toHaveAttribute("aria-current", "true");
  });

  it("reports the category picked", async () => {
    const { onSelect } = setup({ selectedCategory: null });

    await userEvent.click(screen.getByRole("button", { name: "AI - GPU 9" }));

    expect(onSelect).toHaveBeenCalledWith("AI - GPU");
  });

  it("reports no category when All is picked", async () => {
    const { onSelect } = setup({ selectedCategory: "AI - GPU" });

    await userEvent.click(screen.getByRole("button", { name: "All 12" }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  function setup(input: { selectedCategory: string | null }) {
    const filters: UseCaseFilter[] = [
      { category: null, label: "All", count: 12 },
      { category: "AI - GPU", label: "AI - GPU", count: 9 },
      { category: "Retro Arcade", label: "Retro Arcade", count: 3 }
    ];
    const onSelect = vi.fn();
    render(<TemplateUseCaseNav filters={filters} selectedCategory={input.selectedCategory} onSelect={onSelect} />);
    return { onSelect };
  }
});
