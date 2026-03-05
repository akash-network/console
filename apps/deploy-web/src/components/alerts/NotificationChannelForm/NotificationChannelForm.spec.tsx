import React from "react";
import { PopupProvider } from "@akashnetwork/ui/context";
import { describe, expect, it, vi } from "vitest";

import type { NotificationChannelFormProps } from "./NotificationChannelForm";
import { NotificationChannelForm } from "./NotificationChannelForm";

import { fireEvent, render, screen } from "@testing-library/react";

describe("NotificationChannelForm", () => {
  it("renders form fields", () => {
    setup();

    expect(screen.getByTestId("notification-channel-form-name")).toBeInTheDocument();
    expect(screen.getByTestId("notification-channel-form-emails")).toBeInTheDocument();
  });

  it("shows validation error for incomplete submission", async () => {
    setup();

    fireEvent.change(screen.getByTestId("notification-channel-form-name"), { target: { value: "Test" } });
    fireEvent.click(screen.getByTestId("notification-channel-form-submit"));

    await vi.waitFor(() => {
      expect(screen.getByTestId("notification-channel-form-emails-error")).toBeInTheDocument();
    });
  });

  it("calls onSubmit with valid values", async () => {
    const onSubmit = vi.fn();
    setup({ onSubmit });

    fireEvent.change(screen.getByTestId("notification-channel-form-name"), { target: { value: "Test Contact" } });
    fireEvent.change(screen.getByTestId("notification-channel-form-emails"), { target: { value: "test@example.com" } });

    fireEvent.click(screen.getByTestId("notification-channel-form-submit"));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: "Test Contact", emails: ["test@example.com"] });
    });
  });

  it("disables inputs and buttons when loading", () => {
    setup({ isLoading: true });

    expect(screen.getByTestId("notification-channel-form-name")).toBeDisabled();
    expect(screen.getByTestId("notification-channel-form-emails")).toBeDisabled();
    expect(screen.getByTestId("notification-channel-form-submit")).toBeDisabled();
  });

  function setup(props: Partial<NotificationChannelFormProps> = {}) {
    const defaultProps: NotificationChannelFormProps = {
      initialValues: { name: "", emails: [] },
      onSubmit: vi.fn(),
      isLoading: false,
      ...props
    };

    render(
      <PopupProvider>
        <NotificationChannelForm {...defaultProps} />
      </PopupProvider>
    );
    return defaultProps;
  }
});
