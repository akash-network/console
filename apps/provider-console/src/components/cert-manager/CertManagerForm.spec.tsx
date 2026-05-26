import "@testing-library/jest-dom";

import React from "react";

import type { CertManagerPayload } from "@src/types/certManager";
import { CertManagerForm } from "./CertManagerForm";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverMock });

const VALID_GCP_JSON = JSON.stringify({ type: "service_account", project_id: "demo", private_key: "abc" });

describe("CertManagerForm", () => {
  it("requires a DNS provider selection before submit", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit });

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Select a DNS provider")).toBeInTheDocument();
  });

  it("submits a Cloudflare payload when the cloudflare branch is filled in", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit });

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.type(screen.getByLabelText("Cloudflare API token"), "cf-token-123");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith<[CertManagerPayload]>({
      use_staging: false,
      dns_provider: "cloudflare",
      cloudflare: { api_token: "cf-token-123" }
    });
  });

  it("submits a CloudDNS payload with raw JSON pasted into the textarea", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit });

    await user.click(screen.getByLabelText("Google CloudDNS"));
    await user.type(screen.getByLabelText("GCP project ID"), "my-gcp-project");
    await user.click(screen.getByLabelText("Service account JSON"));
    await user.paste(VALID_GCP_JSON);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith<[CertManagerPayload]>({
      use_staging: false,
      dns_provider: "clouddns",
      clouddns: { project: "my-gcp-project", service_account_json: VALID_GCP_JSON }
    });
  });

  it("rejects an empty Cloudflare API token", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit });

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Cloudflare API token is required")).toBeInTheDocument();
  });

  it("rejects a CloudDNS service account JSON that is neither valid JSON nor base64", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit });

    await user.click(screen.getByLabelText("Google CloudDNS"));
    await user.type(screen.getByLabelText("GCP project ID"), "demo");
    await user.click(screen.getByLabelText("Service account JSON"));
    await user.paste("{ this is not valid json");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Must be valid JSON or base64-encoded JSON")).toBeInTheDocument();
  });

  it("rejects base64-shaped input that does not decode to JSON", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit });

    await user.click(screen.getByLabelText("Google CloudDNS"));
    await user.type(screen.getByLabelText("GCP project ID"), "demo");
    await user.click(screen.getByLabelText("Service account JSON"));
    // "hello world" base64-encoded — decodes successfully but is not JSON.
    await user.paste("aGVsbG8gd29ybGQ=");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Must be valid JSON or base64-encoded JSON")).toBeInTheDocument();
  });

  it("accepts a base64-encoded JSON service account key", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit });

    const base64 = Buffer.from(VALID_GCP_JSON, "utf-8").toString("base64");
    await user.click(screen.getByLabelText("Google CloudDNS"));
    await user.type(screen.getByLabelText("GCP project ID"), "demo");
    await user.click(screen.getByLabelText("Service account JSON"));
    await user.paste(base64);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      dns_provider: "clouddns",
      clouddns: { project: "demo", service_account_json: base64 }
    });
  });

  it("requires acme_email when acmeEmailMode is 'required'", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit, acmeEmailMode: "required" });

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.type(screen.getByLabelText("Cloudflare API token"), "cf-token");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("accepts an empty acme_email when acmeEmailMode is 'optional'", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit, acmeEmailMode: "optional" });

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.type(screen.getByLabelText("Cloudflare API token"), "cf-token");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("acme_email");
  });

  it("includes acme_email in the payload when provided", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    setup({ onSubmit });

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.type(screen.getByPlaceholderText("ops@example.com"), "ops@example.com");
    await user.type(screen.getByLabelText("Cloudflare API token"), "cf-token");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ acme_email: "ops@example.com" });
  });

  it("shows the rootError as a form-level banner", () => {
    setup({ rootError: "dns_provider does not match payload shape" });
    expect(screen.getByText("dns_provider does not match payload shape")).toBeInTheDocument();
  });

  it("displays server-supplied field errors next to the matching field", () => {
    setup({
      defaultValues: { dns_provider: "cloudflare" },
      fieldErrors: { "cert_manager.cloudflare.api_token": "Token rejected by Cloudflare" }
    });
    expect(screen.getByText("Token rejected by Cloudflare")).toBeInTheDocument();
  });

  function setup(input: {
    onSubmit?: (payload: CertManagerPayload) => void;
    acmeEmailMode?: "required" | "optional";
    defaultValues?: { dns_provider?: "cloudflare" | "clouddns"; acme_email?: string };
    rootError?: string;
    fieldErrors?: Record<string, string>;
  }) {
    return render(
      <CertManagerForm
        onSubmit={input.onSubmit ?? jest.fn()}
        acmeEmailMode={input.acmeEmailMode ?? "optional"}
        defaultValues={input.defaultValues}
        rootError={input.rootError}
        fieldErrors={input.fieldErrors}
        submitLabel="Continue"
      />
    );
  }
});
