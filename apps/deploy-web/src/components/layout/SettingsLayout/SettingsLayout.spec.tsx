import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import type { SettingsNavLink } from "@src/hooks/useSettingsNavLinks";
import { DEPENDENCIES, SettingsLayout } from "./SettingsLayout";

import { render, screen } from "@testing-library/react";

describe(SettingsLayout.name, () => {
  it("renders a sidebar link per nav item", () => {
    setup({ links: [navLink("Billing", "/billing", true), navLink("API Keys", "/user/api-keys", false)] });

    expect(screen.getByRole("link", { name: "Billing" })).toHaveAttribute("href", "/billing");
    expect(screen.getByRole("link", { name: "API Keys" })).toHaveAttribute("href", "/user/api-keys");
  });

  it("marks the active link with aria-current", () => {
    setup({ links: [navLink("Billing", "/billing", true), navLink("Usage", "/usage", false)] });

    expect(screen.getByRole("link", { name: "Billing" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Usage" })).not.toHaveAttribute("aria-current");
  });

  it("renders the title, description and header actions", () => {
    setup({ title: "Billing", description: "Manage your balance.", headerActions: <button>Add to Balance</button> });

    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("Manage your balance.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Balance" })).toBeInTheDocument();
  });

  it("renders children", () => {
    setup({ children: <div data-testid="content" /> });

    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("omits the header when neither title nor actions are provided", () => {
    setup({ children: <div>content</div> });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  function setup(input: { links?: SettingsNavLink[]; title?: string; description?: ReactNode; headerActions?: ReactNode; children?: ReactNode }) {
    return render(
      <SettingsLayout
        title={input.title}
        description={input.description}
        headerActions={input.headerActions}
        dependencies={
          {
            ...DEPENDENCIES,
            useSettingsNavLinks: () => input.links ?? [],
            Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
              <a href={href} {...props}>
                {children}
              </a>
            ),
            Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>
          } as unknown as typeof DEPENDENCIES
        }
      >
        {input.children}
      </SettingsLayout>
    );
  }

  function navLink(title: string, url: string, isActive: boolean): SettingsNavLink {
    return { title, url, isActive, icon: () => null };
  }
});
