import React from "react";
import { DialogV2, DialogV2Content, DialogV2Title } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { NotificationChannelFormProps } from "./NotificationChannelForm";
import { NotificationChannelForm } from "./NotificationChannelForm";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(NotificationChannelForm.name, () => {
  it("prefills the name and joins the addresses with commas", () => {
    setup({ initialValues: { name: "Ops team", emails: ["ops@acme.dev", "oncall@acme.dev"] } });

    expect(screen.getByLabelText("Name")).toHaveValue("Ops team");
    expect(screen.getByLabelText("Emails")).toHaveValue("ops@acme.dev, oncall@acme.dev");
  });

  it("keeps the submit button disabled until a value changes", async () => {
    setup({ initialValues: { name: "Ops team", emails: ["ops@acme.dev"] } });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name"), "!");

    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("asks for at least one address", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Name"), "Ops team");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("At least one email is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("asks for a name", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Emails"), "ops@acme.dev");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("names every address that isn't a valid email", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Name"), "Ops team");
    await userEvent.type(screen.getByLabelText("Emails"), "ops@acme.dev, nope, also-nope");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Invalid email addresses: nope, also-nope")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits several addresses trimmed and without duplicates", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Name"), "Ops team");
    await userEvent.type(screen.getByLabelText("Emails"), " ops@acme.dev ,oncall@acme.dev,, ops@acme.dev");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: "Ops team", emails: ["ops@acme.dev", "oncall@acme.dev"] });
    });
  });

  it("doesn't submit a form it is rendered inside", async () => {
    const onOuterSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { onSubmit } = setup({ initialValues: { name: "Ops team", emails: ["ops@acme.dev"] }, onOuterSubmit });

    await userEvent.type(screen.getByLabelText("Name"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it("cancels without submitting", async () => {
    const { onSubmit, onCancel } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("locks the fields and actions while saving", () => {
    setup({ isLoading: true });

    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("Emails")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Save changes/ })).toBeDisabled();
  });

  function setup(input: Partial<NotificationChannelFormProps> & { onOuterSubmit?: (event: React.FormEvent) => void } = {}) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const onOuterSubmit = input.onOuterSubmit ?? vi.fn();

    render(
      <form onSubmit={onOuterSubmit}>
        <DialogV2 open>
          <DialogV2Content aria-describedby={undefined}>
            <DialogV2Title>Channel</DialogV2Title>
            <NotificationChannelForm
              initialValues={input.initialValues}
              submitLabel="Save changes"
              isLoading={input.isLoading}
              onSubmit={input.onSubmit ?? onSubmit}
              onCancel={onCancel}
            />
          </DialogV2Content>
        </DialogV2>
      </form>
    );

    return { onSubmit, onCancel };
  }
});
