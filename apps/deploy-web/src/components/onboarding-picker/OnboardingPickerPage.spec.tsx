import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { EnqueueSnackbar, ProviderContext } from "notistack";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnsureTrialStartedResult } from "@src/hooks/useEnsureTrialStarted";
import { DEPENDENCIES, OnboardingPickerPage } from "./OnboardingPickerPage";

import { act, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

type PickerCardProps = Parameters<typeof DEPENDENCIES.DeploymentTemplatePickerCard>[0];
type ContainerProps = Parameters<typeof DEPENDENCIES.PhasedDeploymentContainer>[0];

describe(OnboardingPickerPage.name, () => {
  it("renders a card per template with its template name and matching sdl", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({
      templates: { helloWorld: "hello-sdl", imageGen: "image-sdl", llmChatbot: "llm-sdl" },
      dependencies: { DeploymentTemplatePickerCard }
    });

    const titles = DeploymentTemplatePickerCard.mock.calls.map(call => (call[0] as PickerCardProps).title);
    expect(titles).toEqual(["Hello world", "Image Generation", "LLM Chatbot"]);
  });

  it("shows the picker view and not the deployment container by default", () => {
    const PhasedDeploymentContainer = vi.fn(ComponentMock);
    setup({ dependencies: { PhasedDeploymentContainer } });

    expect(screen.getByRole("heading", { name: "Let's deploy your first app" })).toBeInTheDocument();
    expect(PhasedDeploymentContainer).not.toHaveBeenCalled();
  });

  it("switches to the deployment container with the chosen template's name and sdl", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const PhasedDeploymentContainer = vi.fn(ComponentMock);
    setup({
      templates: { helloWorld: "hello-sdl", imageGen: "image-sdl", llmChatbot: "llm-sdl" },
      dependencies: { DeploymentTemplatePickerCard, PhasedDeploymentContainer }
    });

    const imageGenCard = DeploymentTemplatePickerCard.mock.calls.find(call => (call[0] as PickerCardProps).title === "Image Generation");
    act(() => (imageGenCard![0] as PickerCardProps).onDeploy!());

    const containerProps = PhasedDeploymentContainer.mock.calls.at(-1)![0] as ContainerProps;
    expect(containerProps.templateName).toBe("Image Generation");
    expect(containerProps.sdl).toBe("image-sdl");
  });

  it("returns to the picker view when the container cancels", async () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const PhasedDeploymentContainer = vi.fn(ComponentMock);
    setup({ dependencies: { DeploymentTemplatePickerCard, PhasedDeploymentContainer } });

    const helloCard = DeploymentTemplatePickerCard.mock.calls.find(call => (call[0] as PickerCardProps).title === "Hello world");
    act(() => (helloCard![0] as PickerCardProps).onDeploy!());
    const containerProps = PhasedDeploymentContainer.mock.calls.at(-1)![0] as ContainerProps;
    act(() => containerProps.onCancel!());

    expect(await screen.findByRole("heading", { name: "Let's deploy your first app" })).toBeInTheDocument();
  });

  it("renders an error alert when trial start fails terminally", () => {
    const useEnsureTrialStarted: () => EnsureTrialStartedResult = () => ({ isWalletReady: false, isLoading: false, error: new Error("boom") });
    setup({ dependencies: { useEnsureTrialStarted } });

    expect(screen.getByText(/We couldn't set up your trial/i)).toBeInTheDocument();
  });

  it("does not render the error alert when trial start has not failed", () => {
    setup();

    expect(screen.queryByText(/We couldn't set up your trial/i)).not.toBeInTheDocument();
  });

  it("enqueues a success snackbar and redirects to the deployment details on success", () => {
    const enqueueSnackbar = vi.fn();
    const replace = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const PhasedDeploymentContainer = vi.fn(ComponentMock);
    setup({
      enqueueSnackbar,
      replace,
      dependencies: { DeploymentTemplatePickerCard, PhasedDeploymentContainer }
    });

    const helloCard = DeploymentTemplatePickerCard.mock.calls.find(call => (call[0] as PickerCardProps).title === "Hello world");
    act(() => (helloCard![0] as PickerCardProps).onDeploy!());
    const containerProps = PhasedDeploymentContainer.mock.calls.at(-1)![0] as ContainerProps;
    act(() => containerProps.onSuccess!("12345"));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
    expect(replace).toHaveBeenCalledWith("/deployments/12345");
  });

  function setup(
    input: {
      templates?: OnboardingPickerPageProps["templates"];
      enqueueSnackbar?: EnqueueSnackbar;
      replace?: () => void;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const enqueueSnackbar: EnqueueSnackbar = input.enqueueSnackbar ?? vi.fn<EnqueueSnackbar>();
    const replace: () => void = input.replace ?? vi.fn();
    const useRouter: () => AppRouterInstance = vi.fn(() => mock<AppRouterInstance>({ replace }));
    const useSnackbar: () => ProviderContext = vi.fn(() => mock<ProviderContext>({ enqueueSnackbar }));
    const useEnsureTrialStarted: () => EnsureTrialStartedResult = vi.fn(() => ({ isWalletReady: true, isLoading: false, error: null }));

    return render(
      <OnboardingPickerPage
        templates={input.templates ?? { helloWorld: "hello-sdl", imageGen: "image-sdl", llmChatbot: "llm-sdl" }}
        dependencies={MockComponents(DEPENDENCIES, { useSnackbar, useRouter, useEnsureTrialStarted, ...input.dependencies })}
      />
    );
  }
});

type OnboardingPickerPageProps = Parameters<typeof OnboardingPickerPage>[0];
