import { describe, expect, it } from "vitest";

import { AlertStatus } from "./AlertStatus";

import { render, screen } from "@testing-library/react";

describe(AlertStatus.name, () => {
  it.each([
    { status: "OK", label: "Ok" },
    { status: "TRIGGERED", label: "Triggered" }
  ])("labels the $status status as $label", ({ status, label }) => {
    render(<AlertStatus status={status} />);

    expect(screen.getByText(label)).toHaveAttribute("data-status", status);
  });
});
