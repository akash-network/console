import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./ShareOutsideSection";
import { ShareOutsideSection } from "./ShareOutsideSection";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const TEMPLATE_ID = "0b0f5f0c-2f0d-4f43-9f43-0d1c1b7f2a11";
const LINK = `${window.location.origin}/template/${TEMPLATE_ID}`;
const BADGE_IMAGE = `${window.location.origin}/images/deploy-with-akash-btn.svg`;
const MARKDOWN = `[![Deploy on Akash](${BADGE_IMAGE})](${LINK}?utm_source=badge)`;
const HTML = `<a href="${LINK}?utm_source=badge"><img src="${BADGE_IMAGE}" alt="Deploy on Akash" height="44"></a>`;

describe(ShareOutsideSection.name, () => {
  it("shows the template link and copies it", async () => {
    const { writeText, enqueueSnackbar } = setup({});

    expect(screen.getByRole("textbox", { name: "Template link" })).toHaveValue(LINK);
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Link copied", iconVariant: "success" }) }),
      {
        variant: "success"
      }
    );
  });

  it("tells the user when the browser refuses to copy", async () => {
    const { enqueueSnackbar } = setup({ isCopyFailing: true });

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Couldn't copy it", subTitle: "Select the text and copy it yourself.", iconVariant: "error" })
      }),
      { variant: "error" }
    );
  });

  it("selects a field's text when it gets focus", async () => {
    setup({ hasBadge: true });
    const link = screen.getByRole<HTMLInputElement>("textbox", { name: "Template link" });
    const markdown = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Markdown badge code" });

    await userEvent.click(link);
    expect(link.selectionStart).toBe(0);
    expect(link.selectionEnd).toBe(LINK.length);

    await userEvent.click(markdown);
    expect(markdown.selectionStart).toBe(0);
    expect(markdown.selectionEnd).toBe(MARKDOWN.length);
  });

  it("keeps the badge back from a template strangers cannot open", () => {
    setup({ hasBadge: false });

    expect(screen.queryByText("Deploy on Akash badge")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Markdown badge code" })).not.toBeInTheDocument();
  });

  it("previews the badge and offers it in Markdown and HTML", () => {
    setup({ hasBadge: true });

    expect(screen.getByRole("img", { name: "Deploy on Akash" })).toHaveAttribute("src", "/images/deploy-with-akash-btn.svg");
    expect(screen.getByRole("textbox", { name: "Markdown badge code" })).toHaveValue(MARKDOWN);
    expect(screen.getByRole("textbox", { name: "HTML badge code" })).toHaveValue(HTML);
  });

  it.each([
    ["Markdown", MARKDOWN],
    ["HTML", HTML]
  ])("copies the %s badge code", async (label, snippet) => {
    const { writeText, enqueueSnackbar } = setup({ hasBadge: true });

    await userEvent.click(screen.getByRole("button", { name: `Copy ${label}` }));

    expect(writeText).toHaveBeenCalledWith(snippet);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: `${label} copied` }) }), {
      variant: "success"
    });
  });

  function setup(input: { hasBadge?: boolean; isCopyFailing?: boolean }) {
    const enqueueSnackbar = vi.fn();
    const writeText = input.isCopyFailing ? vi.fn().mockRejectedValue(new Error("denied")) : vi.fn().mockResolvedValue(undefined);
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    onTestFinished(() => {
      if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
    });
    const snackbar = mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });

    render(<ShareOutsideSection templateId={TEMPLATE_ID} hasBadge={input.hasBadge ?? false} dependencies={{ useSnackbar: () => snackbar }} />);

    return { writeText, enqueueSnackbar };
  }
});
