import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { NotificationChannelsOutput } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import type { FCWithChildren } from "@src/types/component";
import type { DEPENDENCIES } from "./NotificationChannelSelect";
import { NotificationChannelSelectView } from "./NotificationChannelSelect";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";

describe(NotificationChannelSelectView.name, () => {
  it("renders select with placeholder when no data", () => {
    setup({ data: [] });

    expect(screen.queryByLabelText("Notification Channel")).toBeInTheDocument();
    expect(screen.queryByText("Select notification channel")).toBeInTheDocument();
  });

  it("renders select trigger when data is provided", () => {
    setup();

    expect(screen.queryByLabelText("Notification Channel")).toBeInTheDocument();
  });

  it("keeps the label visible by default", () => {
    setup();

    expect(screen.getByText("Notification Channel")).not.toHaveClass("sr-only");
  });

  it("hides the label visually but keeps the select named when asked to", () => {
    setup({ isLabelHidden: true });

    expect(screen.getByText("Notification Channel")).toHaveClass("sr-only");
    expect(screen.getByLabelText("Notification Channel")).toBeInTheDocument();
  });

  it("disables select when disabled prop is true", () => {
    setup({ disabled: true });

    const selectTrigger = screen.getByLabelText("Notification Channel");
    expect(selectTrigger).toBeDisabled();
  });

  it("shows error state when field has error", () => {
    setup({ fieldError: "Notification Channel is required" });

    const selectTrigger = screen.getByLabelText("Notification Channel");
    const label = screen.getByText("Notification Channel");

    expect(selectTrigger).toHaveClass("border-red-500");
    expect(screen.queryByText("Notification Channel is required")).toBeInTheDocument();
    expect(label).toHaveClass("cursor-not-allowed");
  });

  it("adds a notification channel in a dialog and selects it", async () => {
    const createdChannel = buildNotificationChannel({ name: "Ops team" });
    setup({ createdChannel });
    expect(screen.queryByTestId("notification-channel-dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add notification channel" }));
    await userEvent.click(screen.getByRole("button", { name: "Create channel" }));

    expect(screen.getByTestId("selected-channel")).toHaveTextContent(createdChannel.id);
    expect(screen.getByTestId("selected-channel")).toHaveAttribute("data-dirty", "true");
  });

  it("offers a created channel the loaded page doesn't list yet", async () => {
    const createdChannel = buildNotificationChannel({ name: "Ops team" });
    setup({ createdChannel });

    await userEvent.click(screen.getByRole("button", { name: "Add notification channel" }));
    await userEvent.click(screen.getByRole("button", { name: "Create channel" }));
    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "Ops team" })).toHaveAttribute("aria-selected", "true");
  });

  it("doesn't list a created channel twice once the loaded page has it", async () => {
    const createdChannel = buildNotificationChannel({ name: "Ops team" });
    setup({ createdChannel, data: [buildNotificationChannel({ name: "Default" }), createdChannel] });

    await userEvent.click(screen.getByRole("button", { name: "Add notification channel" }));
    await userEvent.click(screen.getByRole("button", { name: "Create channel" }));
    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Default", "Ops team"]);
  });

  it("closes the add channel dialog when it asks to", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Add notification channel" }));
    await userEvent.click(screen.getByRole("button", { name: "Close channel dialog" }));

    expect(screen.queryByTestId("notification-channel-dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("selected-channel")).toHaveTextContent("");
  });

  it("disables the add channel button when disabled prop is true", () => {
    setup({ disabled: true });

    expect(screen.getByRole("button", { name: "Add notification channel" })).toBeDisabled();
  });

  function setup(
    input: {
      data?: NotificationChannelsOutput;
      disabled?: boolean;
      isLabelHidden?: boolean;
      fieldError?: string;
      createdChannel?: ReturnType<typeof buildNotificationChannel>;
    } = {}
  ) {
    const createdChannel = input.createdChannel ?? buildNotificationChannel();
    const NotificationChannelDialog: typeof DEPENDENCIES.NotificationChannelDialog = ({ onCreate, onClose }) => (
      <div data-testid="notification-channel-dialog">
        <button onClick={() => onCreate?.(createdChannel)}>Create channel</button>
        <button onClick={onClose}>Close channel dialog</button>
      </div>
    );
    const SelectedChannel = () => {
      const { watch, formState } = useFormContext();
      return (
        <output data-testid="selected-channel" data-dirty={String(!!formState.dirtyFields.notificationChannelId)}>
          {watch("notificationChannelId")}
        </output>
      );
    };
    const notificationChannels = [buildNotificationChannel({ name: "Email: alice@example.com" }), buildNotificationChannel({ name: "Email: bob@example.com" })];

    const Wrapper: FCWithChildren = ({ children }) => {
      const methods = useForm({
        defaultValues: { notificationChannelId: "" },
        mode: "onChange"
      });

      if (input.fieldError) {
        methods.setError("notificationChannelId", { message: input.fieldError });
      }

      return <FormProvider {...methods}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <NotificationChannelSelectView
          name="notificationChannelId"
          data={input.data || notificationChannels}
          isFetched={true}
          disabled={input.disabled}
          isLabelHidden={input.isLabelHidden}
          dependencies={{ NotificationChannelDialog: vi.fn(NotificationChannelDialog) }}
        />
        <SelectedChannel />
      </Wrapper>
    );

    return { notificationChannels };
  }
});
