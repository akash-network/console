import { FormProvider, useForm } from "react-hook-form";

import type { NotificationChannelsOutput } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import type { FCWithChildren } from "@src/types/component";
import { NotificationChannelSelectView } from "./NotificationChannelSelect";

import { render, screen } from "@testing-library/react";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";

describe("NotificationChannelSelectView", () => {
  it("renders select with placeholder when no data", () => {
    setup({ data: [] });

    expect(screen.queryByText("Notification Channel")).toBeInTheDocument();
    expect(screen.queryByText("Select notification channel")).toBeInTheDocument();
  });

  it("renders select trigger when data is provided", () => {
    setup();

    expect(screen.queryByText("Notification Channel")).toBeInTheDocument();
    expect(screen.getByTestId("notification-channel-select-trigger")).toBeInTheDocument();
  });

  it("disables select when disabled prop is true", () => {
    setup({ disabled: true });

    const selectTrigger = screen.getByTestId("notification-channel-select-trigger");
    expect(selectTrigger).toBeDisabled();
  });

  it("shows error state when field has error", () => {
    setup({ fieldError: "Notification Channel is required" });

    const selectTrigger = screen.getByTestId("notification-channel-select-trigger");
    expect(selectTrigger).toHaveClass("border-red-500");
    expect(screen.queryByText("Notification Channel is required")).toBeInTheDocument();
  });

  it("renders add notification channel link", () => {
    setup();

    const addLink = screen.getByRole("link", { name: "" });
    expect(addLink).toHaveAttribute("href", "/alerts/notification-channels/new");
  });

  it("disables add link when disabled prop is true", () => {
    setup({ disabled: true });

    const addLink = screen.getByRole("link", { name: "" });
    expect(addLink).toHaveClass("opacity-10");
    expect(addLink).toHaveClass("cursor-not-allowed");
  });

  it("applies error styling to label when disabled", () => {
    setup({ disabled: true });

    const label = screen.getByText("Notification Channel");
    expect(label).toHaveClass("cursor-not-allowed");
    expect(label).toHaveClass("text-red-500");
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
