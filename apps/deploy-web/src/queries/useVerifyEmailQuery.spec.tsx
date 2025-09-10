import type { AuthHttpService } from "@akashnetwork/http-sdk";
import { mock } from "jest-mock-extended";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider";
import { setupQuery } from "../../tests/unit/query-client";
import { useVerifyEmail } from "./useVerifyEmailQuery";

import { act, waitFor } from "@testing-library/react";

describe(useVerifyEmail.name, () => {
  const mockAuthService = mock<AuthHttpService>();

  const defaultServices: ServicesProviderProps["services"] = {
    auth: () => mockAuthService
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls auth.verifyEmail with the provided email", async () => {
    const mockResponse = {
      data: {
        emailVerified: true
      }
    };

    mockAuthService.verifyEmail.mockResolvedValue(mockResponse);

    const { result } = setupQuery(() => useVerifyEmail(), {
      services: defaultServices
    });

    await act(async () => {
      result.current.mutate("test@example.com");
    });

    await waitFor(() => {
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("calls onSuccess callback with emailVerified status when verification succeeds", async () => {
    const mockResponse = {
      data: {
        emailVerified: true
      }
    };

    mockAuthService.verifyEmail.mockResolvedValue(mockResponse);
    const onSuccessCallback = jest.fn();

    const { result } = setupQuery(() => useVerifyEmail({ onSuccess: onSuccessCallback }), {
      services: defaultServices
    });

    await act(async () => {
      result.current.mutate("test@example.com");
    });

    await waitFor(() => {
      expect(onSuccessCallback).toHaveBeenCalledWith(true);
    });
  });

  it("calls onSuccess callback with false when email is not verified", async () => {
    const mockResponse = {
      data: {
        emailVerified: false
      }
    };

    mockAuthService.verifyEmail.mockResolvedValue(mockResponse);
    const onSuccessCallback = jest.fn();

    const { result } = setupQuery(() => useVerifyEmail({ onSuccess: onSuccessCallback }), {
      services: defaultServices
    });

    await act(async () => {
      result.current.mutate("test@example.com");
    });

    await waitFor(() => {
      expect(onSuccessCallback).toHaveBeenCalledWith(false);
    });
  });

  it("calls onError callback when verification fails", async () => {
    const error = new Error("Verification failed");
    mockAuthService.verifyEmail.mockRejectedValue(error);
    const onErrorCallback = jest.fn();

    const { result } = setupQuery(() => useVerifyEmail({ onError: onErrorCallback }), {
      services: defaultServices
    });

    await act(async () => {
      result.current.mutate("test@example.com");
    });

    await waitFor(() => {
      expect(onErrorCallback).toHaveBeenCalled();
    });
  });
});
