import React from "react";

import { protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import type { ServiceType } from "@src/types";
import { DEPENDENCIES, ShareDeployButton } from "./ShareDeployButton";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ShareDeployButton.name, () => {
  it("renders share button when services have public repo URL", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Share deploy button" })).toBeInTheDocument();
  });

  it("does not render button when services is undefined", () => {
    setup({ services: undefined });
    expect(screen.queryByRole("button", { name: "Share deploy button" })).not.toBeInTheDocument();
  });

  it("does not render button when services is empty array", () => {
    setup({ services: [] });
    expect(screen.queryByRole("button", { name: "Share deploy button" })).not.toBeInTheDocument();
  });

  it("does not render button when repo URL is not public", () => {
    setup({
      services: [
        {
          env: [
            {
              id: "repo-url",
              key: protectedEnvironmentVariables.REPO_URL,
              value: "git@github.com:test/repo.git",
              isSecret: false
            }
          ]
        } as unknown as ServiceType
      ]
    });
    expect(screen.queryByRole("button", { name: "Share deploy button" })).not.toBeInTheDocument();
  });

  it("does not render button when repo URL is missing", () => {
    setup({
      services: [
        {
          env: []
        } as unknown as ServiceType
      ]
    });
    expect(screen.queryByRole("button", { name: "Share deploy button" })).not.toBeInTheDocument();
  });

  it("opens modal when share button is clicked", async () => {
    const user = userEvent.setup();
    const { mockCreateCustom } = setup();

    const button = screen.queryByRole("button", { name: "Share deploy button" });
    await user.click(button!);

    await waitFor(() => {
      expect(mockCreateCustom).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Share Deploy Button",
          maxWidth: "md",
          enableCloseOnBackdropClick: true,
          fullWidth: true
        })
      );
    });
  });

  it("renders correct content in all three tabs", async () => {
    const user = userEvent.setup();
    const { mockCreateCustom } = setup();

    const button = screen.queryByRole("button", { name: "Share deploy button" });
    await user.click(button!);

    await waitFor(() => {
      expect(mockCreateCustom).toHaveBeenCalled();
    });

    const callArgs = mockCreateCustom.mock.calls[0][0];
    const message = callArgs.message as React.ReactElement;

    const expectedDeployUrl = "https://console.akash.network/new-deployment?repoUrl=https%3A%2F%2Fgithub.com%2Ftest%2Frepo&branch=main";
    const expectedMarkdownSnippet = `[![Deploy on Akash](https://raw.githubusercontent.com/akash-network/support/main/deploy-with-akash-btn.svg)](${expectedDeployUrl})`;
    const expectedHtmlSnippet = `<a href="${expectedDeployUrl}"><img src="https://raw.githubusercontent.com/akash-network/support/main/deploy-with-akash-btn.svg" alt="Deploy on Akash"></a>`;

    render(message);

    // Check Markdown tab content (default active tab)
    const markdownInput = screen.queryByDisplayValue(expectedMarkdownSnippet);
    expect(markdownInput).toBeInTheDocument();

    // Check HTML tab content
    const htmlTab = screen.queryByRole("tab", { name: "HTML" });
    await user.click(htmlTab!);
    const htmlInput = screen.queryByDisplayValue(expectedHtmlSnippet);
    expect(htmlInput).toBeInTheDocument();

    // Check URL tab content
    const urlTab = screen.queryByRole("tab", { name: "URL" });
    await user.click(urlTab!);
    const urlInput = screen.queryByDisplayValue(expectedDeployUrl);
    expect(urlInput).toBeInTheDocument();
  });

  function setup(input?: { services?: ServiceType[]; dependencies?: Partial<typeof DEPENDENCIES> }) {
    const mockCreateCustom = jest.fn();
    const mockConfirm = jest.fn();
    const mockSelect = jest.fn();
    const mockRequireAction = jest.fn();
    const mockEnqueueSnackbar = jest.fn();
    const mockCloseSnackbar = jest.fn();
    const mockCopyTextToClipboard = jest.fn();
    const mockGetBaseUrl = jest.fn(() => "https://console.akash.network");

    const services: ServiceType[] | undefined =
      input && "services" in input
        ? input.services
        : ([
            {
              env: [
                {
                  id: "repo-url",
                  key: protectedEnvironmentVariables.REPO_URL,
                  value: "https://github.com/test/repo",
                  isSecret: false
                },
                {
                  id: "branch",
                  key: protectedEnvironmentVariables.BRANCH_NAME,
                  value: "main",
                  isSecret: false
                }
              ]
            }
          ] as unknown as ServiceType[]);

    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      usePopup: () => ({
        createCustom: mockCreateCustom,
        confirm: mockConfirm,
        select: mockSelect,
        requireAction: mockRequireAction
      }),
      useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar, closeSnackbar: mockCloseSnackbar }),
      copyTextToClipboard: mockCopyTextToClipboard,
      getBaseUrl: input?.dependencies?.getBaseUrl || mockGetBaseUrl,
      ...input?.dependencies
    };

    render(<ShareDeployButton services={services} dependencies={dependencies} />);

    return {
      mockCreateCustom,
      mockEnqueueSnackbar,
      mockCopyTextToClipboard
    };
  }
});
