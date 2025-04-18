import nock from "nock";

import { useSettings } from "@src/context/SettingsProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { setupQuery } from "../../tests/unit/query-client";
import { useDepositParams, useSaveSettings } from "./useSettings";

import { waitFor } from "@testing-library/react";

jest.mock("@src/context/SettingsProvider");
jest.mock("@src/hooks/useCustomUser");

const mockEnqueueSnackbar = jest.fn();
jest.mock("notistack", () => ({
  useSnackbar: () => ({
    enqueueSnackbar: mockEnqueueSnackbar
  })
}));

const mockSettings = {
  apiEndpoint: "https://test-api.com"
};

const mockDepositParams = [
  {
    denom: "uakt",
    minDeposit: "1000000"
  }
];

describe("useSettings", () => {
  let mockCheckSession: jest.Mock;

  beforeEach(() => {
    mockCheckSession = jest.fn();
    (useSettings as jest.Mock).mockReturnValue({ settings: mockSettings });
    (useCustomUser as jest.Mock).mockReturnValue({ checkSession: mockCheckSession });

    nock.cleanAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe("useSaveSettings", () => {
    it("should save settings successfully, call checkSession and show success snackbar", async () => {
      const newSettings = {
        username: "testuser",
        subscribedToNewsletter: true
      };

      nock("http://localhost").put("/api/proxy/user/updateSettings").reply(
        200,
        {},
        {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
          "access-control-allow-headers": "Content-Type, Accept"
        }
      );

      const { result } = setupQuery(() => useSaveSettings());

      result.current.mutate(newSettings);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(nock.isDone()).toBe(true);
      expect(mockCheckSession).toHaveBeenCalled();
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Settings saved", { variant: "success" });
    });

    it("should handle error when saving settings and show error snackbar", async () => {
      const newSettings = {
        username: "testuser",
        subscribedToNewsletter: true
      };

      nock("http://localhost").put("/api/proxy/user/updateSettings").reply(
        500,
        { error: "Failed to save settings" },
        {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
          "access-control-allow-headers": "Content-Type, Accept"
        }
      );

      const { result } = setupQuery(() => useSaveSettings());

      result.current.mutate(newSettings);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(nock.isDone()).toBe(true);
      expect(mockCheckSession).not.toHaveBeenCalled();
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Error saving settings", { variant: "error" });
    });
  });

  describe("useDepositParams", () => {
    it("should fetch deposit params successfully", async () => {
      nock(mockSettings.apiEndpoint)
        .get("/cosmos/params/v1beta1/params")
        .query({ subspace: "deployment", key: "MinDeposits" })
        .reply(
          200,
          { param: { value: JSON.stringify(mockDepositParams) } },
          {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
            "access-control-allow-headers": "Content-Type, Accept"
          }
        );

      const { result } = setupQuery(() => useDepositParams());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockDepositParams);
    });

    it("should handle error when fetching deposit params", async () => {
      nock(mockSettings.apiEndpoint).get("/cosmos/params/v1beta1/params").query({ subspace: "deployment", key: "MinDeposits" }).reply(
        500,
        { error: "Failed to fetch deposit params" },
        {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
          "access-control-allow-headers": "Content-Type, Accept"
        }
      );

      const { result } = setupQuery(() => useDepositParams());

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
});
