import { describe, expect, it } from "vitest";

import { domainName, UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, ProvidersPage } from "./ProvidersPage";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("ProvidersPage", () => {
  it("titles the page and links to the provider playbook in a new tab", () => {
    setup();

    expect(screen.getByRole("heading", { level: 1, name: "Providers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Become a provider" })).toHaveAttribute(
      "href",
      "https://akash.network/docs/providers/setup-and-installation/provider-playbook/"
    );
    expect(screen.getByRole("link", { name: "Become a provider" })).toHaveAttribute("target", "_blank");
  });

  it("describes the page for search engines at its canonical address", () => {
    const { dependencies } = setup();

    expect(dependencies.CustomNextSeo).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Providers", url: `${domainName}${UrlService.providers()}` }),
      expect.anything()
    );
  });

  function setup() {
    const dependencies = MockComponents(DEPENDENCIES);
    render(<ProvidersPage dependencies={dependencies} />);
    return { dependencies };
  }
});
