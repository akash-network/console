import { FormattedNumber } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomIntlProvider } from "./CustomIntlProvider";

import { render, screen } from "@testing-library/react";

describe(CustomIntlProvider.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats with the browser's locale", async () => {
    setup({ browserLanguage: "de-DE" });

    expect(await screen.findByText("1.234,5")).toBeInTheDocument();
  });

  it("formats with the locale of a POSIX browser language instead of crashing", async () => {
    setup({ browserLanguage: "de-DE@posix" });

    expect(await screen.findByText("1.234,5")).toBeInTheDocument();
  });

  function setup(input: { browserLanguage: string }) {
    vi.spyOn(navigator, "language", "get").mockReturnValue(input.browserLanguage);

    render(
      <CustomIntlProvider>
        <FormattedNumber value={1234.5} />
      </CustomIntlProvider>
    );
  }
});
