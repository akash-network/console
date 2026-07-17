import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./ThemeToggle";
import { ThemeToggle } from "./ThemeToggle";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ThemeToggle.name, () => {
  it("sets the light theme and persists it in a cookie", async () => {
    const { setTheme } = setup({ theme: "dark" });

    await userEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(setTheme).toHaveBeenCalledWith("light");
    expect(document.cookie).toContain("theme=light");
  });

  it("sets the dark theme and persists it in a cookie", async () => {
    const { setTheme } = setup({ theme: "light" });

    await userEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(document.cookie).toContain("theme=dark");
  });

  function setup(input: { theme?: string }) {
    const setTheme = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useTheme: () => mock<ReturnType<typeof DEPENDENCIES.useTheme>>({ setTheme, theme: input.theme })
    };

    render(<ThemeToggle dependencies={dependencies} />);

    return { setTheme };
  }
});
