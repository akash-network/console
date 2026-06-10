import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./TemplateList";
import { TemplateList } from "./TemplateList";

import { render, screen } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(TemplateList.name, () => {
  it("hides the Build and Deploy card when the flag is disabled", () => {
    setup({ isBuildAndDeployEnabled: false });

    expect(screen.queryByText("Build and Deploy")).not.toBeInTheDocument();
    expect(screen.getByText("Launch Container-VM")).toBeInTheDocument();
    expect(screen.getByText("Run Custom Container")).toBeInTheDocument();
  });

  it("shows the Build and Deploy card when the flag is enabled", () => {
    setup({ isBuildAndDeployEnabled: true });

    expect(screen.getByText("Build and Deploy")).toBeInTheDocument();
    expect(screen.getByText("Launch Container-VM")).toBeInTheDocument();
    expect(screen.getByText("Run Custom Container")).toBeInTheDocument();
  });

  function setup(input: { isBuildAndDeployEnabled?: boolean }) {
    const push = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    // Stable references across renders — a fresh `templates` array each render would re-trigger
    // TemplateList's `useEffect([templates])` indefinitely (react-query returns a stable ref in prod).
    const templatesResult = mock<ReturnType<typeof DEPENDENCIES.useTemplates>>({ templates: [] });
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });

    const dependencies: typeof DEPENDENCIES = {
      useTemplates: () => templatesResult,
      useRouter: () => router,
      useFlag: flagName => (flagName === "ui_build_and_deploy" && input.isBuildAndDeployEnabled) ?? false
    };

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <TemplateList onChangeGitProvider={vi.fn()} onTemplateSelected={vi.fn()} setEditedManifest={vi.fn()} dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { push, analyticsService };
  }
});
