import { describe, expect, it, vi } from "vitest";

import { ApiKeySecret, copyApiKeySecret } from "./ApiKeySecret";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const SECRET = "ac.sk.staging.0123456789abcdef";

describe("ApiKeySecret", () => {
  it("shows the secret and hands it over to copy", async () => {
    const onCopy = vi.fn();
    render(<ApiKeySecret secret={SECRET} onCopy={onCopy} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Copy to clipboard" }));

    expect(screen.getByLabelText("API key secret")).toHaveTextContent(SECRET);
    expect(onCopy).toHaveBeenCalledWith(SECRET);
  });

  describe("copyApiKeySecret", () => {
    it("copies the secret and confirms it", async () => {
      const { writeText, enqueueSnackbar } = setup();

      await copyApiKeySecret(SECRET, enqueueSnackbar);

      expect(writeText).toHaveBeenCalledWith(SECRET);
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Key copied to clipboard" }) }), {
        variant: "success",
        autoHideDuration: 1500
      });
    });

    it("asks the user to copy it themselves when the clipboard refuses", async () => {
      const { writeText, enqueueSnackbar } = setup();
      writeText.mockRejectedValue(new Error("denied"));

      await copyApiKeySecret(SECRET, enqueueSnackbar);

      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't copy the key", subTitle: "Select it and copy it yourself." }) }),
        { variant: "error" }
      );
    });
  });

  function setup() {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const enqueueSnackbar = vi.fn();
    return { writeText, enqueueSnackbar };
  }
});
