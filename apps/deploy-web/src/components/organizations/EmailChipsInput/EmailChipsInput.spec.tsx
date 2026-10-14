import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { EmailChipsInput, parseEmailList } from "./EmailChipsInput";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(EmailChipsInput.name, () => {
  it("turns the draft into a chip on a comma", async () => {
    const { user, input, onChange } = setup({});

    await user.type(input, "Bob@Acme.com,");

    expect(onChange).toHaveBeenLastCalledWith(["bob@acme.com"]);
    expect(input).toHaveValue("");
  });

  it("turns the draft into a chip on a space", async () => {
    const { user, input, onChange } = setup({});

    await user.type(input, "bob@acme.com ");

    expect(onChange).toHaveBeenLastCalledWith(["bob@acme.com"]);
  });

  it("turns the draft into a chip on Enter without submitting the form", async () => {
    const { user, input, onChange, onSubmit } = setup({});

    await user.type(input, "bob@acme.com{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(["bob@acme.com"]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("turns pasted addresses into chips", async () => {
    const { user, input, onChange } = setup({});

    await user.click(input);
    await user.paste("bob@acme.com, carol@acme.com;dave@acme.com");

    expect(onChange).toHaveBeenLastCalledWith(["bob@acme.com", "carol@acme.com", "dave@acme.com"]);
    expect(input).toHaveValue("");
  });

  it("turns the draft into a chip when focus leaves", async () => {
    const { user, input, onChange } = setup({});

    await user.type(input, "bob@acme.com");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(["bob@acme.com"]);
  });

  it("keeps each address once", async () => {
    const { user, input, onChange } = setup({ emails: ["bob@acme.com"] });

    await user.type(input, "BOB@acme.com,");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByText("bob@acme.com")).toHaveLength(1);
  });

  it("removes a chip from its button", async () => {
    const { user, onChange } = setup({ emails: ["bob@acme.com", "carol@acme.com"] });

    await user.click(screen.getByRole("button", { name: "Remove bob@acme.com" }));

    expect(onChange).toHaveBeenLastCalledWith(["carol@acme.com"]);
    expect(screen.queryByText("bob@acme.com")).not.toBeInTheDocument();
  });

  it("removes the last chip with Backspace on an empty draft", async () => {
    const { user, input, onChange } = setup({ emails: ["bob@acme.com", "carol@acme.com"] });

    await user.click(input);
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenLastCalledWith(["bob@acme.com"]);
  });

  it("marks a chip the caller rejects with the reason", () => {
    setup({ emails: ["nope", "bob@acme.com"], getError: email => (email === "nope" ? "Not a valid email address" : null) });

    expect(screen.getByText("nope")).toHaveAttribute("title", "Not a valid email address");
    expect(screen.getByText("bob@acme.com")).not.toHaveAttribute("title");
  });

  it("drops the placeholder once a chip exists", () => {
    const { input } = setup({ emails: ["bob@acme.com"] });

    expect(input).toHaveAttribute("placeholder", "");
  });

  it("focuses the draft when the field is clicked", async () => {
    const { user, input } = setup({ emails: ["bob@acme.com"] });

    await user.click(screen.getByText("bob@acme.com"));

    expect(input).toHaveFocus();
  });

  describe(parseEmailList.name, () => {
    it("splits on commas, semicolons and whitespace, trimming and lowercasing", () => {
      expect(parseEmailList(" Bob@Acme.com, carol@acme.com;\n dave@acme.com ")).toEqual(["bob@acme.com", "carol@acme.com", "dave@acme.com"]);
    });
  });

  function setup(input: { emails?: string[]; getError?: (email: string) => string | null }) {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    function Harness() {
      const [emails, setEmails] = useState(input.emails ?? []);
      return (
        <form onSubmit={onSubmit}>
          <EmailChipsInput
            id="emails"
            emails={emails}
            getError={input.getError}
            onChange={next => {
              setEmails(next);
              onChange(next);
            }}
          />
        </form>
      );
    }

    render(<Harness />);

    return { user: userEvent.setup(), input: screen.getByPlaceholderText(input.emails?.length ? "" : "name@company.com"), onChange, onSubmit };
  }
});
