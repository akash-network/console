import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { LeaseDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useSendDeploymentAgain";
import { useSendDeploymentAgain } from "./useSendDeploymentAgain";

import { act, renderHook } from "@testing-library/react";

describe(useSendDeploymentAgain.name, () => {
  it("requests the deployment's live leases again in the background, then refreshes the activity feed", async () => {
    const { result, requestLeases, queryClient } = setup({});

    await act(() =>
      result.current.sendAgain([
        lease({ dseq: "1234", gseq: 1, oseq: 1, provider: "akash1live", state: "active" }),
        lease({ dseq: "1234", gseq: 2, oseq: 1, provider: "akash1gone", state: "closed" })
      ])
    );

    expect(requestLeases).toHaveBeenCalledWith({ async: "true", leases: [{ dseq: "1234", gseq: 1, oseq: 1, provider: "akash1live" }] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["listActivities"] });
  });

  it("tells the user why the deployment could not be sent", async () => {
    const { result, enqueueSnackbar, queryClient } = setup({
      refusal: new ApiError(409, { message: "A lease is already being created" }, "POST /v1/leases → 409")
    });

    await act(() => result.current.sendAgain([lease({ state: "active" })]));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't send the deployment", subTitle: "A lease is already being created" }) }),
      { variant: "error" }
    );
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("asks the user to try again when the refusal carries no reason", async () => {
    const { result, enqueueSnackbar } = setup({ refusal: new Error() });

    await act(() => result.current.sendAgain([lease({ state: "active" })]));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ subTitle: "Try again in a moment." }) }), {
      variant: "error"
    });
  });

  it("reports while a send is on its way", () => {
    expect(setup({ isPending: true }).result.current.isSending).toBe(true);
    expect(setup({ isPending: false }).result.current.isSending).toBe(false);
  });

  function lease(input: Partial<LeaseDto>): LeaseDto {
    return mock<LeaseDto>({ dseq: "1234", gseq: 1, oseq: 1, provider: "akash1provider", reclamation: undefined, ...input });
  }

  function setup(input: { refusal?: Error; isPending?: boolean }) {
    const requestLeases = input.refusal ? vi.fn().mockRejectedValue(input.refusal) : vi.fn().mockResolvedValue({ data: { activityId: "a1" } });
    const enqueueSnackbar = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();

    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.listActivities.getKey.mockReturnValue(["listActivities"]);
    api.v1.createLease.useMutation.mockReturnValue(
      mock<ReturnType<typeof api.v1.createLease.useMutation>>({ mutateAsync: requestLeases as never, isPending: input.isPending ?? false })
    );

    const dependencies: typeof DEPENDENCIES = {
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ api }),
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }),
      useQueryClient: () => queryClient
    };

    const { result } = renderHook(() => useSendDeploymentAgain(dependencies));

    return { result, requestLeases, enqueueSnackbar, queryClient };
  }
});
