import type { InternalAxiosRequestConfig } from "axios";
import { AxiosHeaders } from "axios";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createTabOrganizationFetch, createTabOrganizationInterceptor, TabOrganization } from "./tab-organization";

describe(TabOrganization.name, () => {
  it("names no organization until the tab shows one", () => {
    expect(new TabOrganization().organizationId).toBeUndefined();
  });

  it("names the organization the tab shows", () => {
    const tabOrganization = new TabOrganization();

    tabOrganization.show("org-a");

    expect(tabOrganization.organizationId).toBe("org-a");
  });

  it("names no organization once the tab shows none", () => {
    const tabOrganization = new TabOrganization();
    tabOrganization.show("org-a");

    tabOrganization.show(undefined);

    expect(tabOrganization.organizationId).toBeUndefined();
  });

  describe("actIn", () => {
    it("names the given organization while the work runs and the shown one again after", async () => {
      const tabOrganization = new TabOrganization();
      tabOrganization.show("org-a");
      let namedDuringWork: string | undefined;

      const result = await tabOrganization.actIn("org-b", async () => {
        namedDuringWork = tabOrganization.organizationId;
        return "done";
      });

      expect({ result, namedDuringWork, namedAfter: tabOrganization.organizationId }).toEqual({
        result: "done",
        namedDuringWork: "org-b",
        namedAfter: "org-a"
      });
    });

    it("names the shown organization again when the work fails", async () => {
      const tabOrganization = new TabOrganization();
      tabOrganization.show("org-a");

      await expect(tabOrganization.actIn("org-b", () => Promise.reject(new Error("card declined")))).rejects.toThrow("card declined");

      expect(tabOrganization.organizationId).toBe("org-a");
    });

    it("keeps an organization the tab moved to while the work ran", async () => {
      const tabOrganization = new TabOrganization();
      tabOrganization.show("org-a");

      await tabOrganization.actIn("org-b", async () => tabOrganization.show("org-c"));

      expect(tabOrganization.organizationId).toBe("org-c");
    });
  });
});

describe(createTabOrganizationInterceptor.name, () => {
  it("names the organization the tab shows on a call through the API proxy", () => {
    const { config } = setup({ organizationId: "org-a", baseURL: "/api/proxy" });

    expect(config.headers.get("x-organization-id")).toBe("org-a");
  });

  it("names nothing on a call to another host", () => {
    const { config } = setup({ organizationId: "org-a", baseURL: "https://api.akash.network" });

    expect(config.headers.has("x-organization-id")).toBe(false);
  });

  it("names nothing while the tab shows no organization", () => {
    const { config } = setup({ organizationId: undefined, baseURL: "/api/proxy" });

    expect(config.headers.has("x-organization-id")).toBe(false);
  });

  function setup(input: { organizationId: string | undefined; baseURL: string }) {
    const tabOrganization = new TabOrganization();
    tabOrganization.show(input.organizationId);
    const config = createTabOrganizationInterceptor(tabOrganization)(mock<InternalAxiosRequestConfig>({ baseURL: input.baseURL, headers: new AxiosHeaders() }));

    return { config };
  }
});

describe(createTabOrganizationFetch.name, () => {
  it("names the organization the tab shows and keeps the caller's request", async () => {
    const { fetchImpl, response } = await setup({ organizationId: "org-a", init: { method: "POST", headers: { "content-type": "application/json" } } });

    expect(fetchImpl).toHaveBeenCalledWith("/api/proxy/v1/projects", expect.objectContaining({ method: "POST" }));
    expect(getSentHeaders(fetchImpl).get("x-organization-id")).toBe("org-a");
    expect(getSentHeaders(fetchImpl).get("content-type")).toBe("application/json");
    expect(response.status).toBe(204);
  });

  it("names the organization the tab shows on a call made without options", async () => {
    const { fetchImpl } = await setup({ organizationId: "org-a", init: undefined });

    expect(getSentHeaders(fetchImpl).get("x-organization-id")).toBe("org-a");
  });

  it("passes the request through unchanged while the tab shows no organization", async () => {
    const init = { method: "GET", headers: { "content-type": "application/json" } };
    const { fetchImpl } = await setup({ organizationId: undefined, init });

    expect(fetchImpl).toHaveBeenCalledWith("/api/proxy/v1/projects", init);
  });

  function getSentHeaders(fetchImpl: Mock<typeof fetch>): Headers {
    return fetchImpl.mock.calls[0]![1]!.headers as Headers;
  }

  async function setup(input: { organizationId: string | undefined; init: RequestInit | undefined }) {
    const tabOrganization = new TabOrganization();
    tabOrganization.show(input.organizationId);
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const response = await createTabOrganizationFetch(tabOrganization, fetchImpl)("/api/proxy/v1/projects", input.init);

    return { fetchImpl, response };
  }
});
