import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { DEPENDENCIES } from "./useCloseDeployment";
import { useCloseDeployment } from "./useCloseDeployment";

import { renderHook } from "@testing-library/react";

const DSEQ = "1786440078202";

describe(useCloseDeployment.name, () => {
  it("hands the close to the background and reports the deployment closing", async () => {
    const { result, requestClose, queryClient } = setup({});

    expect(await result.current(DSEQ)).toBe("closing");
    expect(requestClose).toHaveBeenCalledWith({ dseq: DSEQ, async: "true" });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["listActivities"] });
  });

  it("reports the deployment closed when the close finished during the request", async () => {
    const { result, queryClient } = setup({ closeResponse: { data: { success: true } } });

    expect(await result.current(DSEQ)).toBe("closed");
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["listActivities"] });
  });

  it("tells the user why the close was refused and reports the deployment not closed", async () => {
    const refusal = new ApiError(402, { message: "Not enough credits to close this deployment" }, `DELETE /v1/deployments/${DSEQ} → 402`);
    const { result, enqueueSnackbar } = setup({ closeRefusal: refusal });

    expect(await result.current(DSEQ)).toBe("not_closed");
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          title: "Couldn't close this deployment",
          subTitle: "Not enough credits to close this deployment",
          iconVariant: "error"
        })
      }),
      { variant: "error" }
    );
  });

  it("asks the user to try again when a refusal carries no reason", async () => {
    const { result, enqueueSnackbar } = setup({ closeRefusal: new Error("Failed to fetch") });

    await result.current(DSEQ);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ subTitle: "Try again in a moment." }) }), {
      variant: "error"
    });
  });

  function setup(input: { closeResponse?: { data: { activityId: string } | { success: boolean } }; closeRefusal?: Error }) {
    const requestClose = input.closeRefusal
      ? vi.fn().mockRejectedValue(input.closeRefusal)
      : vi.fn().mockResolvedValue(input.closeResponse ?? { data: { activityId: "b6f2d8e4-0f7c-4b37-9b52-6a1f0d3c2e11" } });
    const enqueueSnackbar = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();

    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.listActivities.getKey.mockReturnValue(["listActivities"]);
    api.v1.closeDeployment.useMutation.mockReturnValue(mock<ReturnType<typeof api.v1.closeDeployment.useMutation>>({ mutateAsync: requestClose as never }));

    const dependencies: typeof DEPENDENCIES = {
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ api }),
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }),
      useQueryClient: () => queryClient
    };

    const { result } = renderHook(() => useCloseDeployment(dependencies));

    return { result, requestClose, enqueueSnackbar, queryClient };
  }
});
