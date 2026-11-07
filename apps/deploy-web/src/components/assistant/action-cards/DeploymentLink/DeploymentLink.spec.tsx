import { describe, expect, it } from "vitest";

import { UrlService } from "@src/utils/urlUtils";
import { DeploymentLink } from "./DeploymentLink";

import { render, screen } from "@testing-library/react";

describe(DeploymentLink.name, () => {
  it("links the deployment by its name", () => {
    render(<DeploymentLink dseq="1793975053644" name="llama-chat" />);

    expect(screen.getByRole("link", { name: "llama-chat" })).toHaveAttribute("href", UrlService.deploymentDetails("1793975053644"));
  });

  it.each([null, ""])("links a deployment named %j without showing its dseq", name => {
    render(<DeploymentLink dseq="1793975053644" name={name} />);

    expect(screen.getByRole("link", { name: "View deployment" })).toHaveAttribute("href", UrlService.deploymentDetails("1793975053644"));
    expect(screen.queryByText(/1793975053644/)).not.toBeInTheDocument();
  });
});
