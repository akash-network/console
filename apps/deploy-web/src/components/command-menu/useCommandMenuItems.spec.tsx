import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentsListSource, DeploymentsListSourceInput } from "@src/components/deployments/DeploymentsList/useApiDeploymentsListSource";
import type { LeaseDto, ListedDeploymentDto } from "@src/types/deployment";
import { parseQuery } from "./commandMenuSearch";
import type { CommandItem } from "./useCommandMenuItems";
import type { DEPENDENCIES } from "./useCommandMenuItems";
import { useCommandMenuItems } from "./useCommandMenuItems";

import { renderHook } from "@testing-library/react";

describe(useCommandMenuItems.name, () => {
  it("lists actions, deployments and pages in that order", () => {
    const { sections } = setup({ active: [deployment({ dseq: "100", name: "web" })] });

    expect(sections.map(({ key, label, emptyQueryLimit }) => ({ key, label, emptyQueryLimit }))).toEqual([
      { key: "actions", label: "Actions", emptyQueryLimit: undefined },
      { key: "deployments", label: "Deployments", emptyQueryLimit: 5 },
      { key: "pages", label: "Pages", emptyQueryLimit: undefined }
    ]);
  });

  describe("actions", () => {
    it("offers the handoff's actions with their search keywords", () => {
      const { itemsOf } = setup({});

      expect(itemsOf("actions").map(({ id, label, keywords, action }) => ({ id, label, keywords, action }))).toEqual([
        { id: "action-new-deployment", label: "New deployment", keywords: "create deploy launch", action: "new_deployment" },
        {
          id: "action-new-container",
          label: "New container",
          keywords: "docker image byo bring your own container deploy configure",
          action: "new_container"
        },
        {
          id: "action-new-linux-machine",
          label: "New Linux machine",
          keywords: "ssh ubuntu debian centos suse vm server linux deploy configure",
          action: "new_linux_machine"
        },
        { id: "action-deploy-from-template", label: "Deploy from a template", keywords: "templates catalog", action: "deploy_from_template" },
        { id: "action-add-funds", label: "Add funds", keywords: "billing balance top up credit", action: "add_funds" },
        { id: "action-toggle-theme", label: "Switch to dark theme", keywords: "theme appearance mode dark light", action: "toggle_theme" },
        { id: "action-keyboard-shortcuts", label: "Keyboard shortcuts", keywords: "help hotkeys keys", action: "keyboard_shortcuts" }
      ]);
    });

    it("shows the shortcut of each action that has one", () => {
      const { itemsOf } = setup({});

      expect(Object.fromEntries(itemsOf("actions").map(({ id, shortcut }) => [id, shortcut]))).toEqual({
        "action-new-deployment": { keys: ["N"] },
        "action-new-container": { keys: ["shift", "C"] },
        "action-new-linux-machine": { keys: ["shift", "L"] },
        "action-deploy-from-template": undefined,
        "action-add-funds": undefined,
        "action-toggle-theme": undefined,
        "action-keyboard-shortcuts": { keys: ["?"] }
      });
    });

    it("opens the keyboard shortcuts sheet", () => {
      const { run, onShowShortcuts } = setup({});

      run("actions", "Keyboard shortcuts");

      expect(onShowShortcuts).toHaveBeenCalled();
    });

    it.each([
      { label: "New deployment", kind: "new-deployment" },
      { label: "New container", kind: "container" },
      { label: "New Linux machine", kind: "linux" }
    ])("starts $kind from $label", ({ label, kind }) => {
      const { run, startDeployment } = setup({});

      run("actions", label);

      expect(startDeployment).toHaveBeenCalledWith(kind);
    });

    it("opens the templates gallery", () => {
      const { run, push } = setup({});

      run("actions", "Deploy from a template");

      expect(push).toHaveBeenCalledWith("/templates");
    });

    it("opens the add credits sheet for a verified email", () => {
      const { run, openAddCredits, runWhenEmailVerified } = setup({ isEmailVerified: true });

      run("actions", "Add funds");

      expect(runWhenEmailVerified).toHaveBeenCalledWith("Verify your email to add funds to your balance.", expect.any(Function));
      expect(openAddCredits).toHaveBeenCalledWith({ context: "command_menu" });
    });

    it("leaves the add credits sheet closed until the email is verified", () => {
      const { run, openAddCredits } = setup({ isEmailVerified: false });

      run("actions", "Add funds");

      expect(openAddCredits).not.toHaveBeenCalled();
    });

    it("keeps the user on the page only for the theme switch", () => {
      const { sections } = setup({ active: [deployment({ dseq: "100" })] });

      expect(sections.flatMap(section => section.items.filter(item => item.staysOnPage).map(item => item.id))).toEqual(["action-toggle-theme"]);
    });

    it("switches a dark theme to light", () => {
      const { run, setTheme, itemsOf } = setup({ resolvedTheme: "dark" });

      run("actions", "Switch to light theme");

      expect(itemsOf("actions").find(item => item.id === "action-toggle-theme")?.label).toBe("Switch to light theme");
      expect(setTheme).toHaveBeenCalledWith("light");
      expect(document.cookie).toContain("theme=light");
    });

    it("switches a light theme to dark", () => {
      const { run, setTheme } = setup({ resolvedTheme: "light" });

      run("actions", "Switch to dark theme");

      expect(setTheme).toHaveBeenCalledWith("dark");
      expect(document.cookie).toContain("theme=dark");
    });
  });

  describe("deployments", () => {
    it("names each deployment, falling back to its dseq", () => {
      const { itemsOf } = setup({ active: [deployment({ dseq: "100", name: "web" }), deployment({ dseq: "99", name: null })] });

      expect(itemsOf("deployments").map(({ id, label, keywords, isMonospace, action }) => ({ id, label, keywords, isMonospace, action }))).toEqual([
        { id: "deployment-100", label: "web", keywords: "100", isMonospace: true, action: "open_deployment" },
        { id: "deployment-99", label: "Deployment #99", keywords: "99", isMonospace: true, action: "open_deployment" }
      ]);
    });

    it("shows the dseq, plus the status when it isn't running", () => {
      const { itemsOf } = setup({
        query: "a",
        active: [deployment({ dseq: "100" }), deployment({ dseq: "99", leases: [closedLease()] })],
        closed: [deployment({ dseq: "98", state: "closed" })]
      });

      expect(itemsOf("deployments").map(({ meta, statusDotClassName }) => ({ meta, statusDotClassName }))).toEqual([
        { meta: "DSEQ 100", statusDotClassName: "bg-emerald-500" },
        { meta: "DSEQ 99 · Closed", statusDotClassName: "bg-warning" },
        { meta: "DSEQ 98 · Closed", statusDotClassName: "bg-muted-foreground" }
      ]);
    });

    it("lists running deployments first, then the other active ones, then closed ones, newest first", () => {
      const { itemsOf } = setup({
        query: "a",
        active: [
          deployment({ dseq: "7", leases: [closedLease()] }),
          deployment({ dseq: "5" }),
          deployment({ dseq: "9", leases: [closedLease()] }),
          deployment({ dseq: "6" })
        ],
        closed: [deployment({ dseq: "3", state: "closed" }), deployment({ dseq: "8", state: "closed" })]
      });

      expect(itemsOf("deployments").map(({ id }) => id)).toEqual([
        "deployment-6",
        "deployment-5",
        "deployment-9",
        "deployment-7",
        "deployment-8",
        "deployment-3"
      ]);
    });

    it("hides closed deployments until there is a query", () => {
      const { itemsOf } = setup({ active: [deployment({ dseq: "100" })], closed: [deployment({ dseq: "98", state: "closed" })] });

      expect(itemsOf("deployments").map(({ id }) => id)).toEqual(["deployment-100"]);
    });

    it("shows closed deployments in the deployments scope", () => {
      const { itemsOf } = setup({ input: "@", active: [deployment({ dseq: "100" })], closed: [deployment({ dseq: "98", state: "closed" })] });

      expect(itemsOf("deployments").map(({ id }) => id)).toEqual(["deployment-100", "deployment-98"]);
    });

    it.each<{ input: string; request: Pick<DeploymentsListSourceInput, "search" | "pageSize"> }>([
      { input: "", request: { search: "", pageSize: 6 } },
      { input: "Web", request: { search: "web", pageSize: 6 } },
      { input: "@ web", request: { search: "web", pageSize: 50 } },
      { input: "@", request: { search: "", pageSize: 50 } },
      { input: "> web", request: { search: "", pageSize: 6 } },
      { input: "/ web", request: { search: "", pageSize: 6 } }
    ])("asks for $request.pageSize deployments matching '$request.search' for '$input'", ({ input, request }) => {
      const { useApiDeploymentsListSource } = setup({ input });

      expect(useApiDeploymentsListSource).toHaveBeenCalledWith({ ...request, pageIndex: 0, archivePageIndex: 0 });
    });

    it("opens the deployment", () => {
      const { run, push } = setup({ active: [deployment({ dseq: "100", name: "web" })] });

      run("deployments", "web");

      expect(push).toHaveBeenCalledWith("/deployments/100");
    });
  });

  describe("pages", () => {
    it("reaches each page with G then its letter", () => {
      const { itemsOf } = setup({});

      expect(itemsOf("pages").map(({ shortcut }) => shortcut)).toEqual(
        ["D", "T", "R", "B", "K", "U", "A"].map(letter => ({ keys: ["G", letter], isSequence: true }))
      );
    });

    it("lists the pages with a go-to keyword", () => {
      const { itemsOf } = setup({});

      expect(itemsOf("pages").map(({ id, label, keywords, action }) => ({ id, label, keywords, action }))).toEqual([
        { id: "page-deployments", label: "Deployments", keywords: "go to page", action: "go_to_deployments" },
        { id: "page-templates", label: "Templates", keywords: "go to page", action: "go_to_templates" },
        { id: "page-providers", label: "Providers", keywords: "go to page", action: "go_to_providers" },
        { id: "page-billing", label: "Billing", keywords: "go to page", action: "go_to_billing" },
        { id: "page-api_keys", label: "API Keys", keywords: "go to page", action: "go_to_api_keys" },
        { id: "page-usage", label: "Usage", keywords: "go to page", action: "go_to_usage" },
        { id: "page-alerts", label: "Alerts", keywords: "go to page", action: "go_to_alerts" }
      ]);
    });

    it("opens the page", () => {
      const { run, push } = setup({});

      run("pages", "API Keys");

      expect(push).toHaveBeenCalledWith("/user/api-keys");
    });
  });

  function deployment(input: Partial<ListedDeploymentDto> & { dseq: string }) {
    return mock<ListedDeploymentDto>({ name: `deployment-${input.dseq}`, state: "active", leases: [], ...input });
  }

  function listSource(active: ListedDeploymentDto[], closed: ListedDeploymentDto[]): DeploymentsListSource {
    const slice = (deployments: ListedDeploymentDto[]) => ({
      deployments,
      hasNextPage: false,
      isResolved: true,
      isFetching: false,
      isError: false,
      isSearchTooBroad: false
    });

    return { appliedSearch: "", active: slice(active), archive: { ...slice(closed), total: closed.length }, refetch: vi.fn() };
  }

  function closedLease() {
    return mock<LeaseDto>({ state: "closed", reason: undefined, reclamation: undefined, group: undefined });
  }

  function setup(input: {
    input?: string;
    query?: string;
    active?: ListedDeploymentDto[];
    closed?: ListedDeploymentDto[];
    resolvedTheme?: string;
    isEmailVerified?: boolean;
  }) {
    document.cookie = "theme=; path=/; Max-Age=0";
    const push = vi.fn();
    const onShowShortcuts = vi.fn();
    const setTheme = vi.fn();
    const openAddCredits = vi.fn();
    const startDeployment = vi.fn(async () => undefined);
    const runWhenEmailVerified = vi.fn((_message: string, proceed: () => void) => {
      if (input.isEmailVerified ?? true) proceed();
    });
    const useApiDeploymentsListSource = vi.fn((_request: DeploymentsListSourceInput) => listSource(input.active ?? [], input.closed ?? []));

    const dependencies: typeof DEPENDENCIES = {
      useRouter: () => mock<AppRouterInstance>({ push }),
      useTheme: () => mock<ReturnType<typeof DEPENDENCIES.useTheme>>({ resolvedTheme: input.resolvedTheme ?? "light", setTheme }),
      useAddCredits: () => openAddCredits,
      useRunWhenEmailVerified: () => runWhenEmailVerified,
      useStartDeployment: () => startDeployment,
      useApiDeploymentsListSource
    };

    const { result } = renderHook(() => useCommandMenuItems({ parsed: parseQuery(input.input ?? input.query ?? ""), onShowShortcuts }, dependencies));
    const sections = result.current;
    const itemsOf = (key: string): CommandItem[] => sections.find(section => section.key === key)?.items ?? [];
    const run = (key: string, label: string) =>
      itemsOf(key)
        .find(item => item.label === label)
        ?.run();

    return { sections, itemsOf, run, push, onShowShortcuts, setTheme, openAddCredits, runWhenEmailVerified, startDeployment, useApiDeploymentsListSource };
  }
});
