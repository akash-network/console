import type { comet38 } from "@cosmjs/tendermint-rpc";
import { Comet38Client } from "@cosmjs/tendermint-rpc";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { TxEventsService } from "@src/modules/chain/services/tx-events-service/tx-events.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(TxEventsService.name, () => {
  describe("getBlockEvents", () => {
    it("propagates an exhausted block-results failure", async () => {
      vi.useFakeTimers();

      try {
        const { module } = await setup();
        const service = module.get<TxEventsService>(TxEventsService);
        const cometClient = module.get<MockProxy<Comet38Client>>(Comet38Client);
        const error = new Error("block results unavailable");
        cometClient.blockResults.mockRejectedValue(error);

        const result = service.getBlockEvents(1).then(
          () => undefined,
          rejection => rejection
        );
        await vi.runAllTimersAsync();

        expect(await result).toBe(error);
        expect(cometClient.blockResults).toHaveBeenCalledTimes(6);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should extract certain events from tx logs", async () => {
      const { module } = await setup();
      const service = module.get<TxEventsService>(TxEventsService);
      const cometClient = module.get<MockProxy<Comet38Client>>(Comet38Client);
      const blockResults: comet38.BlockResultsResponse = {
        height: 22350454,
        results: [
          {
            code: 0,
            codespace: "",
            data: Uint8Array.from([]),
            events: [
              {
                type: "akash.deployment.v1.EventDeploymentCreated",
                attributes: [
                  {
                    key: "hash",
                    value: '"f5151c689bad78ce8bfe614bf22c74ee228a0e31d9a4e973adace676833e5219"'
                  },
                  {
                    key: "id",
                    value: '{"owner":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd","dseq":"22350452"}'
                  },
                  {
                    key: "msg_index",
                    value: "0"
                  }
                ]
              },
              {
                type: "coin_spent",
                attributes: [
                  { key: "spender", value: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd" },
                  { key: "amount", value: "500000uakt" }
                ]
              },
              {
                type: "message",
                attributes: [{ key: "action", value: "/akash.deployment.v1beta3.MsgCreateDeployment" }]
              }
            ],
            gasWanted: 140139n,
            gasUsed: 110798n
          },
          {
            code: 0,
            codespace: "",
            data: Uint8Array.from([]),
            events: [
              {
                type: "akash.deployment.v1.EventDeploymentClosed",
                attributes: [
                  {
                    key: "id",
                    value: '{"owner":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd","dseq":"22350842"}'
                  },
                  {
                    key: "msg_index",
                    value: "0"
                  }
                ]
              },
              {
                type: "coin_received",
                attributes: [
                  { key: "receiver", value: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd" },
                  { key: "amount", value: "499997uakt" }
                ]
              },
              {
                type: "transfer",
                attributes: [
                  { key: "recipient", value: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd" },
                  { key: "sender", value: "akash14pphss726thpwws3yc458hggufynm9x77l4l2u" },
                  { key: "amount", value: "499997uakt" }
                ]
              }
            ],
            gasWanted: 321803n,
            gasUsed: 240558n
          },
          {
            code: 0,
            codespace: "",
            data: Uint8Array.from([]),
            events: [
              {
                type: "akash.deployment.v1.EventDeploymentCreated",
                attributes: [
                  {
                    key: "hash",
                    value: '"f5151c689bad78ce8bfe614bf22c74ee228a0e31d9a4e973adace676833e5219"'
                  },
                  {
                    key: "id",
                    value: '{"owner":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd","dseq":"22350453"}'
                  },
                  {
                    key: "msg_index",
                    value: "0"
                  }
                ]
              },
              {
                type: "akash.deployment.v1.EventDeploymentClosed",
                attributes: [
                  {
                    key: "id",
                    value: '{"owner":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd","dseq":"22350843"}'
                  },
                  {
                    key: "msg_index",
                    value: "0"
                  }
                ]
              },
              {
                type: "coin_spent",
                attributes: [
                  { key: "spender", value: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd" },
                  { key: "amount", value: "500000uakt" }
                ]
              },
              {
                type: "message",
                attributes: [{ key: "action", value: "/akash.deployment.v1beta3.MsgCreateDeployment" }]
              }
            ],
            gasWanted: 321803n,
            gasUsed: 240558n
          }
        ],
        validatorUpdates: [],
        finalizeBlockEvents: []
      };
      cometClient.blockResults.mockResolvedValue(blockResults);
      const result = await service.getBlockEvents(22350454, { source: "akash", action: ["deployment-created", "deployment-closed"] });

      expect(result).toEqual([
        {
          type: "akash.v1",
          module: "deployment",
          action: "deployment-created",
          hash: "f5151c689bad78ce8bfe614bf22c74ee228a0e31d9a4e973adace676833e5219",
          owner: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd",
          dseq: "22350452"
        },
        {
          type: "akash.v1",
          module: "deployment",
          action: "deployment-closed",
          owner: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd",
          dseq: "22350842"
        },
        {
          type: "akash.v1",
          module: "deployment",
          action: "deployment-created",
          hash: "f5151c689bad78ce8bfe614bf22c74ee228a0e31d9a4e973adace676833e5219",
          owner: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd",
          dseq: "22350453"
        },
        {
          type: "akash.v1",
          module: "deployment",
          action: "deployment-closed",
          owner: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd",
          dseq: "22350843"
        }
      ]);
    });

    it("extracts a lease reclaim started event from the market module", async () => {
      const { module } = await setup();
      const service = module.get<TxEventsService>(TxEventsService);
      const cometClient = module.get<MockProxy<Comet38Client>>(Comet38Client);
      const blockResults: comet38.BlockResultsResponse = {
        height: 1,
        results: [
          {
            code: 0,
            codespace: "",
            data: Uint8Array.from([]),
            events: [
              {
                type: "akash.market.v1.EventLeaseReclaimStarted",
                attributes: [
                  {
                    key: "id",
                    value:
                      '{"owner":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd","dseq":"22350842","gseq":1,"oseq":1,"provider":"akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx"}'
                  },
                  { key: "reason", value: '"lease_closed_reason_unstable"' },
                  { key: "deadline", value: '"1749398400"' },
                  { key: "msg_index", value: "0" }
                ]
              }
            ],
            gasWanted: 100000n,
            gasUsed: 80000n
          }
        ],
        validatorUpdates: [],
        finalizeBlockEvents: []
      };
      cometClient.blockResults.mockResolvedValue(blockResults);

      const result = await service.getBlockEvents(1, { source: "akash", module: "market", version: "v1", action: ["lease-reclaim-started"] });

      expect(result).toEqual([
        {
          type: "akash.v1",
          module: "market",
          action: "lease-reclaim-started",
          owner: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd",
          dseq: "22350842",
          gseq: 1,
          oseq: 1,
          provider: "akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx",
          reason: "lease_closed_reason_unstable",
          deadline: "1749398400"
        }
      ]);
    });

    it("extracts a provider maintenance opened event", async () => {
      const { module } = await setup();
      const service = module.get<TxEventsService>(TxEventsService);
      const cometClient = module.get<MockProxy<Comet38Client>>(Comet38Client);
      const blockResults: comet38.BlockResultsResponse = {
        height: 1,
        results: [
          {
            code: 0,
            codespace: "",
            data: Uint8Array.from([]),
            events: [
              {
                type: "akash.provider.v1beta4.EventProviderMaintenanceOpened",
                attributes: [
                  { key: "maintenance_id", value: '"17"' },
                  { key: "provider", value: '"akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx"' },
                  { key: "maintenance_type", value: '"provider_maintenance_type_planned"' },
                  { key: "starts_at", value: '"2026-08-25T12:00:00Z"' },
                  { key: "expected_ends_at", value: '"2026-08-25T14:00:00Z"' },
                  { key: "metadata_hash", value: '"AQID"' },
                  { key: "msg_index", value: "0" }
                ]
              }
            ],
            gasWanted: 100000n,
            gasUsed: 80000n
          }
        ],
        validatorUpdates: [],
        finalizeBlockEvents: []
      };
      cometClient.blockResults.mockResolvedValue(blockResults);

      const result = await service.getBlockEvents(1, {
        source: "akash",
        module: "provider",
        version: "v1beta4",
        action: ["provider-maintenance-opened"]
      });

      expect(result).toEqual([
        {
          type: "akash.v1beta4",
          module: "provider",
          action: "provider-maintenance-opened",
          maintenance_id: "17",
          provider: "akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx",
          maintenance_type: "provider_maintenance_type_planned",
          starts_at: "2026-08-25T12:00:00Z",
          expected_ends_at: "2026-08-25T14:00:00Z",
          metadata_hash: "AQID"
        }
      ]);
    });

    it("applies multiple filters in a single block fetch", async () => {
      const { module } = await setup();
      const service = module.get<TxEventsService>(TxEventsService);
      const cometClient = module.get<MockProxy<Comet38Client>>(Comet38Client);
      const blockResults: comet38.BlockResultsResponse = {
        height: 1,
        results: [
          {
            code: 0,
            codespace: "",
            data: Uint8Array.from([]),
            events: [
              {
                type: "akash.deployment.v1.EventDeploymentClosed",
                attributes: [{ key: "id", value: '{"owner":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd","dseq":"22350843"}' }]
              },
              {
                type: "akash.market.v1.EventLeaseReclaimStarted",
                attributes: [
                  {
                    key: "id",
                    value:
                      '{"owner":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd","dseq":"22350842","gseq":1,"oseq":1,"provider":"akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx"}'
                  },
                  { key: "reason", value: '"lease_closed_reason_unstable"' },
                  { key: "deadline", value: '"1749398400"' }
                ]
              }
            ],
            gasWanted: 100000n,
            gasUsed: 80000n
          }
        ],
        validatorUpdates: [],
        finalizeBlockEvents: []
      };
      cometClient.blockResults.mockResolvedValue(blockResults);

      const result = await service.getBlockEvents(1, [
        { source: "akash", module: "deployment", version: "v1", action: ["deployment-closed"] },
        { source: "akash", module: "market", version: "v1", action: ["lease-reclaim-started"] }
      ]);

      expect(result).toEqual([
        {
          type: "akash.v1",
          module: "deployment",
          action: "deployment-closed",
          owner: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd",
          dseq: "22350843"
        },
        {
          type: "akash.v1",
          module: "market",
          action: "lease-reclaim-started",
          owner: "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd",
          dseq: "22350842",
          gseq: 1,
          oseq: 1,
          provider: "akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx",
          reason: "lease_closed_reason_unstable",
          deadline: "1749398400"
        }
      ]);
    });
  });

  async function setup() {
    const module = await Test.createTestingModule({
      providers: [TxEventsService, { provide: Comet38Client, useValue: mock<Comet38Client>() }, MockProvider(LoggerService)]
    }).compile();

    return {
      module
    };
  }
});
