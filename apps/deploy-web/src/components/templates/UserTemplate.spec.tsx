import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { ITemplate } from "@src/types";
import { DEPENDENCIES, UserTemplate } from "./UserTemplate";

import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(UserTemplate.name, () => {
  it("links the author's name to their profile", () => {
    setup({ template: { userId: "auth0|alice", username: "alice" } });

    expect(screen.getByRole("link", { name: "alice" })).toHaveAttribute("href", "/profile/alice");
  });

  it("records a visit to the author's profile", () => {
    const { analyticsService } = setup({ template: { userId: "auth0|alice", username: "alice" } });

    const profileLink = screen.getByRole("link", { name: "alice" });
    const clickWithoutNavigating = createEvent.click(profileLink);
    clickWithoutNavigating.preventDefault();
    fireEvent(profileLink, clickWithoutNavigating);

    expect(analyticsService.track).toHaveBeenCalledWith("click_sdl_profile", {
      category: "sdl_builder",
      label: "Click on SDL user profile in template detail"
    });
  });

  it("names a deleted account as the author of a team template whose author deleted their account", () => {
    setup({ template: { userId: null, username: "" } });

    expect(screen.getByText("Deleted account")).toBeInTheDocument();
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).not.toContain("/profile/");
  });

  it("describes the template to search engines", () => {
    const { CustomNextSeo } = setup({ id: "a1b2", template: { title: "Web app", description: "Serves the web app" } });

    expect(CustomNextSeo.mock.lastCall?.[0]).toEqual({
      title: "Web app",
      url: "https://console.akash.network/template/a1b2",
      description: "Serves the web app"
    });
  });

  it("gives search engines an empty description for a template without one", () => {
    const { CustomNextSeo } = setup({ template: { description: "" } });

    expect(CustomNextSeo.mock.lastCall?.[0]).toMatchObject({ description: "" });
  });

  function setup(input: { id?: string; template?: Partial<ITemplate> }) {
    const id = input.id ?? "template-id";
    const template: ITemplate = {
      id,
      userId: "auth0|author",
      username: "author",
      title: "My template",
      description: "A template",
      isPublic: true,
      cpu: 1000,
      ram: 512 * 1024 * 1024,
      storage: 1024 * 1024 * 1024,
      sdl: 'version: "2.0"',
      isFavorite: false,
      ...input.template
    };
    const analyticsService = mock<AnalyticsService>();
    const CustomNextSeo = vi.fn<typeof DEPENDENCIES.CustomNextSeo>(() => null);
    const dependencies = MockComponents(DEPENDENCIES, {
      Layout: ({ children }) => <>{children}</>,
      CustomNextSeo,
      useCustomUser: () => mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({ user: undefined }),
      useDeleteTemplate: () => mock<ReturnType<typeof DEPENDENCIES.useDeleteTemplate>>({ isPending: false }),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>()
    });

    render(
      <IntlProvider locale="en-US">
        <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
          <UserTemplate id={id} template={template} dependencies={dependencies} />
        </TestContainerProvider>
      </IntlProvider>
    );

    return { analyticsService, CustomNextSeo };
  }
});
