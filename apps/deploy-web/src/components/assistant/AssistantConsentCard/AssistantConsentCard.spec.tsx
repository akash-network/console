import { describe, expect, it, vi } from "vitest";

import { UrlService } from "@src/utils/urlUtils";
import { ASSISTANT_CONSENT_COPY } from "../assistantConsentCopy";
import { AssistantConsentCard } from "./AssistantConsentCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("AssistantConsentCard", () => {
  it("explains what happens with the user's data and links to the privacy policy", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "Before we start" })).toBeInTheDocument();
    ASSISTANT_CONSENT_COPY.points.forEach(point => expect(screen.getByText(point)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", UrlService.privacyPolicy());
  });

  it("agrees without the review opt-in, which starts unchecked", async () => {
    const { onAgree } = setup({});

    expect(screen.getByRole("checkbox", { name: ASSISTANT_CONSENT_COPY.reviewOptInLabel })).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Agree and start" }));

    expect(onAgree).toHaveBeenCalledWith({ reviewOptIn: false });
  });

  it("agrees with the review opt-in once the user checks it", async () => {
    const { onAgree } = setup({});

    await userEvent.click(screen.getByLabelText(ASSISTANT_CONSENT_COPY.reviewOptInLabel));
    await userEvent.click(screen.getByRole("button", { name: "Agree and start" }));

    expect(onAgree).toHaveBeenCalledWith({ reviewOptIn: true });
  });

  it("declines with Not now", async () => {
    const { onDecline, onAgree } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onAgree).not.toHaveBeenCalled();
  });

  it("says when saving the choice failed and blocks a second save while one runs", () => {
    setup({ hasFailed: true, isSaving: true });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save your choice. Try again.");
    expect(screen.getByText("Agree and start").closest("button")).toBeDisabled();
  });

  function setup(input: { hasFailed?: boolean; isSaving?: boolean }) {
    const onAgree = vi.fn();
    const onDecline = vi.fn();
    render(<AssistantConsentCard isSaving={input.isSaving ?? false} hasFailed={input.hasFailed ?? false} onAgree={onAgree} onDecline={onDecline} />);
    return { onAgree, onDecline };
  }
});
