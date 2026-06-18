import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../utils/httpClient";
import { BmeHttpService } from "./bme-http.service";

describe(BmeHttpService.name, () => {
  describe("waitForLedgerRecordsSettlement", () => {
    it("stops waiting immediately when aborted during the poll interval", async () => {
      vi.useFakeTimers();

      try {
        const { service, httpClient } = setup();
        const abortController = new AbortController();

        httpClient.get.mockResolvedValue({
          data: {
            records: [{ status: "ledger_record_status_pending" }],
            pagination: { next_key: null, total: "1" }
          }
        });

        const result = service.waitForLedgerRecordsSettlement("akash1abc", {
          pollIntervalMs: 30_000,
          maxAttempts: 2,
          signal: abortController.signal
        });

        await vi.waitFor(() => expect(httpClient.get).toHaveBeenCalledTimes(1));
        abortController.abort();

        await expect(result).resolves.toBe(false);
        expect(httpClient.get).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  function setup() {
    const httpClient = {
      get: vi.fn()
    } as unknown as HttpClient & { get: ReturnType<typeof vi.fn> };

    const service = new BmeHttpService(httpClient);

    return { service, httpClient };
  }
});
