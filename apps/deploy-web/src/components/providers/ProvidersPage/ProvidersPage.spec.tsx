import { describe, expect, it } from "vitest";

import { BECOME_A_PROVIDER_URL, DEPENDENCIES, ProvidersPage } from "./ProvidersPage";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("ProvidersPage", () => {
  it("titles the page and links to becoming a provider in a new tab", () => {
    render(<ProvidersPage dependencies={MockComponents(DEPENDENCIES)} />);

    expect(screen.getByRole("heading", { level: 1, name: "Providers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Become a provider" })).toHaveAttribute("href", BECOME_A_PROVIDER_URL);
    expect(screen.getByRole("link", { name: "Become a provider" })).toHaveAttribute("target", "_blank");
  });
});
