import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { addDays, subHours } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import type { ProjectOutput } from "@src/types/project";
import { ALL_PROJECTS_LABEL, ApiKeyList, UNKNOWN_PROJECT_LABEL } from "./ApiKeyList";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildApiKey, buildProject } from "@tests/seeders";

describe(ApiKeyList.name, () => {
  it("shows each key's name, masked value, expiry, creation date and last use", () => {
    setup({
      apiKeys: [
        buildApiKey({
          name: "CI/CD pipeline",
          keyFormat: "ac.sk.mainnet.p7nm2a***9xk4qe",
          expiresAt: "2099-01-15T12:00:00.000Z",
          createdAt: "2026-03-11T12:00:00.000Z",
          lastUsedAt: subHours(new Date(), 2).toISOString()
        })
      ]
    });

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("CI/CD pipeline")).toBeInTheDocument();
    expect(within(row).getByText("ac.sk.mainnet.p7nm2a***9xk4qe")).toBeInTheDocument();
    expect(within(row).getByText("Expires Jan 15, 2099")).toBeInTheDocument();
    expect(within(row).getByText("Created Mar 11, 2026")).toBeInTheDocument();
    expect(within(row).getByText("Last used 2 hours ago")).toBeInTheDocument();
    expect(within(row).queryByText("Expired")).not.toBeInTheDocument();
    expect(within(row).queryByText("Expiring soon")).not.toBeInTheDocument();
  });

  it("lists the newest key first and counts every active key", () => {
    setup({
      apiKeys: [
        buildApiKey({ name: "Older key", createdAt: "2026-01-01T12:00:00.000Z", expiresAt: null }),
        buildApiKey({ name: "Newer key", createdAt: "2026-06-01T12:00:00.000Z", expiresAt: null })
      ]
    });

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Newer key");
    expect(rows[1]).toHaveTextContent("Older key");
    expect(screen.getByText("2 active keys")).toBeInTheDocument();
  });

  it("marks an expired key and leaves it out of the active count", () => {
    setup({
      apiKeys: [
        buildApiKey({ name: "Retired key", expiresAt: "2020-03-01T12:00:00.000Z" }),
        buildApiKey({ name: "Current key", expiresAt: "2099-01-15T12:00:00.000Z" })
      ]
    });

    const expiredRow = screen.getAllByRole("listitem").find(row => row.textContent?.includes("Retired key")) as HTMLElement;
    expect(within(expiredRow).getByText("Expired")).toBeInTheDocument();
    expect(within(expiredRow).getByText("Expired Mar 1, 2020")).toBeInTheDocument();
    expect(screen.getByText("1 active key")).toBeInTheDocument();
  });

  it("flags a key that expires within a week", () => {
    setup({ apiKeys: [buildApiKey({ name: "Short-lived", expiresAt: addDays(new Date(), 3).toISOString() })] });

    expect(within(screen.getByRole("listitem")).getByText("Expiring soon")).toBeInTheDocument();
    expect(screen.getByText("1 active key")).toBeInTheDocument();
  });

  it("shows when a key never expires and has never been used", () => {
    setup({ apiKeys: [buildApiKey({ expiresAt: null, lastUsedAt: null })] });

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("No expiration")).toBeInTheDocument();
    expect(within(row).getByText("Never used")).toBeInTheDocument();
  });

  it("shows the empty state when the account has no keys", () => {
    setup({ apiKeys: [] });

    expect(screen.getByText("No API keys")).toBeInTheDocument();
    expect(screen.getByText("0 active keys")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "API keys" })).not.toBeInTheDocument();
  });

  it("shows the empty state without a count when the keys are unavailable", () => {
    setup({ apiKeys: undefined });

    expect(screen.getByText("No API keys")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "API keys" })).not.toBeInTheDocument();
    expect(screen.queryByText(/active key/)).not.toBeInTheDocument();
  });

  it("says the keys couldn't load instead of claiming there are none", () => {
    setup({ apiKeys: undefined, isError: true });

    expect(screen.getByText("Couldn't load your API keys")).toBeInTheDocument();
    expect(screen.getByText("Refresh the page to try again.")).toBeInTheDocument();
    expect(screen.queryByText("No API keys")).not.toBeInTheDocument();
    expect(screen.queryByText(/active key/)).not.toBeInTheDocument();
  });

  it("keeps showing the loaded keys when a refresh fails", () => {
    setup({ apiKeys: [buildApiKey({ name: "Monitoring" })], isError: true });

    expect(within(screen.getByRole("list", { name: "API keys" })).getByText("Monitoring")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your API keys")).not.toBeInTheDocument();
  });

  it("shows neither the list, the empty state nor a count while keys load", () => {
    setup({ apiKeys: undefined, isLoading: true });

    expect(screen.queryByText("No API keys")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "API keys" })).not.toBeInTheDocument();
    expect(screen.queryByText(/active key/)).not.toBeInTheDocument();
  });

  it("asks to revoke a key from its row menu", async () => {
    const apiKey = buildApiKey({ name: "Monitoring" });
    const { onRevoke } = setup({ apiKeys: [apiKey] });

    await userEvent.click(screen.getByRole("button", { name: "Actions for Monitoring" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Revoke key" }));

    expect(onRevoke).toHaveBeenCalledWith(apiKey);
  });

  it("reminds that keys grant full account access", () => {
    setup({ apiKeys: [] });

    expect(screen.getByText(/API keys grant full access to your Console account/)).toBeInTheDocument();
  });

  it("shows no project column when no projects are given", () => {
    setup({ apiKeys: [buildApiKey({ name: "Monitoring", projectId: null })] });

    expect(screen.queryByText(ALL_PROJECTS_LABEL)).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).not.toHaveTextContent("Project:");
  });

  describe("when projects are given", () => {
    it("reminds that only a key without a project grants full account access", () => {
      setup({ apiKeys: [], projects: [buildProject({ name: "storefront" })] });

      expect(
        screen.getByText(/A key without a project has full access to your Console account, and a key for a project only works on that project/)
      ).toBeInTheDocument();
      expect(screen.queryByText(/API keys grant full access to your Console account/)).not.toBeInTheDocument();
    });

    it("names the project a key is limited to", () => {
      const storefront = buildProject({ name: "storefront" });
      setup({ apiKeys: [buildApiKey({ name: "Deploy bot", projectId: storefront.id })], projects: [buildProject({ name: "default" }), storefront] });

      const row = screen.getByRole("listitem");
      expect(within(row).getByTitle("storefront")).toBeInTheDocument();
      expect(row).toHaveTextContent("Project:storefront");
      expect(within(row).queryByText(ALL_PROJECTS_LABEL)).not.toBeInTheDocument();
    });

    it("says a key without a project reaches all projects", () => {
      setup({ apiKeys: [buildApiKey({ projectId: null })], projects: [buildProject({ name: "storefront" })] });

      const row = screen.getByRole("listitem");
      expect(within(row).getByText(ALL_PROJECTS_LABEL)).toBeInTheDocument();
      expect(row).toHaveTextContent(`Project:${ALL_PROJECTS_LABEL}`);
    });

    it("says a key made before projects reaches all projects", () => {
      setup({ apiKeys: [buildApiKey({ projectId: undefined })], projects: [] });

      expect(within(screen.getByRole("listitem")).getByText(ALL_PROJECTS_LABEL)).toBeInTheDocument();
    });

    it("marks a key limited to a project the user can't see", () => {
      setup({ apiKeys: [buildApiKey({ projectId: faker.string.uuid() })], projects: [buildProject({ name: "storefront" })] });

      const row = screen.getByRole("listitem");
      expect(within(row).getByText(UNKNOWN_PROJECT_LABEL)).toBeInTheDocument();
      expect(within(row).queryByText("storefront")).not.toBeInTheDocument();
    });
  });

  function setup(input: { apiKeys: ApiKeyResponse[] | undefined; isLoading?: boolean; isError?: boolean; projects?: ProjectOutput[] }) {
    const onRevoke = vi.fn();
    render(
      <ApiKeyList apiKeys={input.apiKeys} isLoading={input.isLoading ?? false} isError={input.isError ?? false} onRevoke={onRevoke} projects={input.projects} />
    );
    return { onRevoke };
  }
});
