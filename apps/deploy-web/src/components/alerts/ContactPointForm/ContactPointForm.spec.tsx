import "@testing-library/jest-dom";

import React from "react";
import { PopupProvider } from "@akashnetwork/ui/context";

import type { ContactPointFormProps } from "./ContactPointForm";
import { ContactPointForm } from "./ContactPointForm";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

describe("ContactPointForm", () => {
  it("renders form fields", () => {
    setup();

    expect(screen.getByTestId("contact-point-form-name")).toBeInTheDocument();
    expect(screen.getByTestId("contact-point-form-emails")).toBeInTheDocument();
  });

  it("shows validation error for incomplete submission", async () => {
    setup();

    fireEvent.change(screen.getByTestId("contact-point-form-name"), { target: { value: "Test" } });
    fireEvent.click(screen.getByTestId("contact-point-form-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("contact-point-form-emails-error")).toBeInTheDocument();
    });
  });

  it("calls onSubmit with valid values", async () => {
    const onSubmit = jest.fn();
    setup({ onSubmit });

    fireEvent.change(screen.getByTestId("contact-point-form-name"), { target: { value: "Test Contact" } });
    fireEvent.change(screen.getByTestId("contact-point-form-emails"), { target: { value: "test@example.com" } });

    fireEvent.click(screen.getByTestId("contact-point-form-submit"));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: "Test Contact", emails: ["test@example.com"] });
    });
  });

  it("disables inputs and buttons when loading", () => {
    setup({ isLoading: true });

    expect(screen.getByTestId("contact-point-form-name")).toBeDisabled();
    expect(screen.getByTestId("contact-point-form-emails")).toBeDisabled();
    expect(screen.getByTestId("contact-point-form-submit")).toBeDisabled();
  });

  function setup(props: Partial<ContactPointFormProps> = {}) {
    const defaultProps: ContactPointFormProps = {
      initialValues: { name: "", emails: [] },
      onSubmit: jest.fn(),
      isLoading: false,
      ...props
    };

    render(
      <PopupProvider>
        <ContactPointForm {...defaultProps} />
      </PopupProvider>
    );
    return defaultProps;
  }
});
