import { FormProvider, useForm } from "react-hook-form";

import type { NotificationChannelsOutput } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import type { FCWithChildren } from "@src/types/component";
import { NotificationChannelSelectView } from "./NotificationChannelSelect";

import { render, screen } from "@testing-library/react";
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

  it("renders add notification channel link", () => {
    setup();

    const addLink = screen.getByRole("link", { name: "Add notification channel" });
    expect(addLink).toHaveAttribute("href", "/alerts/notification-channels/new");
  });

  it("disables add link when disabled prop is true", () => {
    setup({ disabled: true });

    const addLink = screen.getByRole("link", { name: "Add notification channel" });
    expect(addLink).toHaveClass("opacity-10");
    expect(addLink).toHaveClass("cursor-not-allowed");
  });

  function setup(input: { data?: NotificationChannelsOutput; disabled?: boolean; fieldError?: string } = {}) {
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
        <NotificationChannelSelectView name="notificationChannelId" data={input.data || notificationChannels} isFetched={true} disabled={input.disabled} />
      </Wrapper>
    );

    return { notificationChannels };
  }
});
