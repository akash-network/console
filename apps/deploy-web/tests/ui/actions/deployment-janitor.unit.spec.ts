import type { APIRequestContext, APIResponse, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { closeAllActiveDeployments } from "./deployment-janitor";

const BASE_URL = "https://console.test";
const LIST_URL = `${BASE_URL}/api/proxy/v1/deployments`;

describe(closeAllActiveDeployments.name, () => {
  it("closes every active deployment and reports their dseqs", async () => {
    const { page, request } = setup({ listings: [["101", "102"], [], []] });

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual(["101", "102"]);

    expect(request.delete).toHaveBeenCalledWith(`${LIST_URL}/101`, expect.anything());
    expect(request.delete).toHaveBeenCalledWith(`${LIST_URL}/102`, expect.anything());
  });

  it("closes a deployment that only shows up after the first listing", async () => {
    const { page } = setup({ listings: [[], ["777"], [], []] });

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual(["777"]);
  });

  it("stops after two consecutive clean listings", async () => {
    const { page, request } = setup({ listings: [[], []] });

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual([]);

    expect(request.get).toHaveBeenCalledTimes(2);
    expect(request.delete).not.toHaveBeenCalled();
  });

  it("does not re-close a deployment the listing still reports as active", async () => {
    const { page, request } = setup({ listings: [["101"], ["101"], ["101"]] });

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual(["101"]);

    expect(request.delete).toHaveBeenCalledTimes(1);
  });

  it("keeps polling while a closed deployment lingers in the listing, so a late create is still caught", async () => {
    const { page, request } = setup({ listings: [["101"], ["101"], ["101"], ["101", "999"]] });

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual(["101", "999"]);

    expect(request.get).toHaveBeenCalledTimes(4);
    expect(request.delete).toHaveBeenCalledWith(`${LIST_URL}/999`, expect.anything());
  });

  it("reports nothing closed and warns when the account cannot be listed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { page, request } = setup({ listStatus: 401 });

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual([]);

    expect(request.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 401"));
    warn.mockRestore();
  });

  it("reports nothing closed and warns when the listing comes back without JSON", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { page, request } = setup();
    request.get.mockResolvedValue(nonJsonResponse());

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual([]);

    expect(request.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("carried no JSON"));
    warn.mockRestore();
  });

  it("skips a listing entry that carries no deployment", async () => {
    const { page, request } = setup();
    request.get.mockResolvedValueOnce(jsonResponse(200, { data: { deployments: [null, { deployment: { id: { dseq: "101" } } }] } }));

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual(["101"]);
  });

  it("reports nothing closed and warns when the deployments field is not a list", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { page, request } = setup();
    request.get.mockResolvedValue(jsonResponse(200, { data: { deployments: {} } }));

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual([]);

    expect(request.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("was not a list"));
    warn.mockRestore();
  });

  it("warns with the dseq that has to be reclaimed by hand when the close keeps failing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { page } = setup({ listings: [["555"], ["555"], ["555"], ["555"]], closeStatus: 500 });

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual([]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("555 (HTTP 500)"));
    warn.mockRestore();
  });

  it("survives a request that never comes back with a response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { page, request } = setup({ listings: [["101"], ["101"], ["101"], ["101"]] });
    request.delete.mockRejectedValue(new Error("socket hang up"));

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual([]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("101 (request failed)"));
    warn.mockRestore();
  });

  it("stops warning about a failed close once the account no longer lists the dseq", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { page, request } = setup({ listings: [["101"], [], []] });
    request.delete.mockRejectedValue(new Error("socket hang up"));

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual([]);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("attempts a failed close again when the dseq comes back after a listing left it out", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { page, request } = setup({ listings: [["101"], [], ["101"], ["101"]], closeStatus: 500 });

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual([]);

    expect(request.delete).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("101 (HTTP 500)"));
    warn.mockRestore();
  });

  it("keeps the dseqs it already closed when the browser goes away between passes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { page } = setup({ listings: [["101"], [], []] });
    page.waitForTimeout.mockRejectedValue(new Error("Target page, context or browser has been closed"));

    await expect(closeAllActiveDeployments(page, BASE_URL)).resolves.toEqual(["101"]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("gave up sweeping the account"));
    warn.mockRestore();
  });

  function setup(input?: { listings?: string[][]; listStatus?: number; closeStatus?: number }) {
    const request = mock<APIRequestContext>();

    for (const dseqs of input?.listings ?? []) {
      request.get.mockResolvedValueOnce(jsonResponse(input?.listStatus ?? 200, deploymentListBody(dseqs)));
    }
    request.get.mockResolvedValue(jsonResponse(input?.listStatus ?? 200, deploymentListBody([])));
    request.delete.mockResolvedValue(jsonResponse(input?.closeStatus ?? 200, { data: { success: true } }));

    const page = Object.assign(mock<Page>(), { request });
    page.waitForTimeout.mockResolvedValue(undefined);

    return { page, request };
  }

  function deploymentListBody(dseqs: string[]) {
    return { data: { deployments: dseqs.map(dseq => ({ deployment: { id: { owner: "akash1owner", dseq } } })) } };
  }

  function jsonResponse(status: number, body: unknown) {
    return mock<APIResponse>({
      ok: () => status >= 200 && status < 300,
      status: () => status,
      json: () => Promise.resolve(body)
    });
  }

  function nonJsonResponse() {
    return mock<APIResponse>({
      ok: () => true,
      status: () => 200,
      json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input"))
    });
  }
});
