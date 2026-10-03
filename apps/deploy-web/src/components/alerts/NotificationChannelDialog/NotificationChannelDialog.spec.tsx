import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./NotificationChannelDialog";
import { NotificationChannelDialog } from "./NotificationChannelDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";

describe(NotificationChannelDialog.name, () => {
  it("adds a new channel through the create container", async () => {
    const { NotificationChannelForm, create } = setup({});

    expect(screen.getByRole("dialog", { name: "Add notification channel" })).toBeInTheDocument();
    const formProps = NotificationChannelForm.mock.lastCall![0];
    expect(formProps).toMatchObject({ submitLabel: "Add channel", isLoading: false });
    expect(formProps.initialValues).toBeUndefined();

    formProps.onSubmit({ name: "Ops team", emails: ["ops@acme.dev"] });

    expect(create).toHaveBeenCalledWith({ name: "Ops team", emails: ["ops@acme.dev"] });
  });

  it("hands over the created channel and closes", () => {
    const createdChannel = buildNotificationChannel();
    const { NotificationChannelCreateContainer, onCreate, onClose } = setup({});

    NotificationChannelCreateContainer.mock.lastCall![0].onCreate!(createdChannel);

    expect(onCreate).toHaveBeenCalledWith(createdChannel);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes after creating a channel even when nobody listens for it", () => {
    const { NotificationChannelCreateContainer, onClose } = setup({ withoutOnCreate: true });

    NotificationChannelCreateContainer.mock.lastCall![0].onCreate!(buildNotificationChannel());

    expect(onClose).toHaveBeenCalled();
  });

  it("edits an existing channel through the edit container", () => {
    const channel = buildNotificationChannel({ name: "Ops team", config: { addresses: ["ops@acme.dev", "oncall@acme.dev"] } });
    const { NotificationChannelForm, NotificationChannelEditContainer, onEdit, onClose } = setup({ notificationChannel: channel });

    expect(screen.getByRole("dialog", { name: "Edit notification channel" })).toBeInTheDocument();
    expect(NotificationChannelEditContainer.mock.lastCall![0]).toMatchObject({ id: channel.id, onEditSuccess: onClose });
    const formProps = NotificationChannelForm.mock.lastCall![0];
    expect(formProps).toMatchObject({ submitLabel: "Save changes", initialValues: { name: "Ops team", emails: ["ops@acme.dev", "oncall@acme.dev"] } });

    formProps.onSubmit({ name: "Ops", emails: ["ops@acme.dev"] });

    expect(onEdit).toHaveBeenCalledWith({ name: "Ops", emails: ["ops@acme.dev"] });
  });

  it("closes when the form is cancelled", () => {
    const { NotificationChannelForm, onClose } = setup({});

    NotificationChannelForm.mock.lastCall![0].onCancel();

    expect(onClose).toHaveBeenCalled();
  });

  it("closes from its close button", async () => {
    const { onClose } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    { mode: "a new channel", notificationChannel: undefined },
    { mode: "channel edits", notificationChannel: buildNotificationChannel() }
  ])("can't be dismissed while saving $mode", async ({ notificationChannel }) => {
    const { onClose, NotificationChannelForm } = setup({ notificationChannel, isSaving: true });

    expect(NotificationChannelForm.mock.lastCall![0].isLoading).toBe(true);

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  function setup(input: { notificationChannel?: ReturnType<typeof buildNotificationChannel>; withoutOnCreate?: boolean; isSaving?: boolean }) {
    const create = vi.fn();
    const onEdit = vi.fn();
    const onCreate = vi.fn();
    const onClose = vi.fn();
    const NotificationChannelForm = vi.fn<typeof DEPENDENCIES.NotificationChannelForm>(() => null);
    const NotificationChannelCreateContainer = vi.fn<typeof DEPENDENCIES.NotificationChannelCreateContainer>(({ children }) => (
      <>{children({ create, isLoading: input.isSaving ?? false })}</>
    ));
    const NotificationChannelEditContainer = vi.fn<typeof DEPENDENCIES.NotificationChannelEditContainer>(({ children }) => (
      <>{children({ onEdit, isLoading: input.isSaving ?? false })}</>
    ));

    render(
      <NotificationChannelDialog
        notificationChannel={input.notificationChannel}
        onCreate={input.withoutOnCreate ? undefined : onCreate}
        onClose={onClose}
        dependencies={{ NotificationChannelForm, NotificationChannelCreateContainer, NotificationChannelEditContainer }}
      />
    );

    return { create, onEdit, onCreate, onClose, NotificationChannelForm, NotificationChannelCreateContainer, NotificationChannelEditContainer };
  }
});
