import { Comet38Client } from "@cosmjs/tendermint-rpc";
import type { BlockResultsResponse } from "@cosmjs/tendermint-rpc/build/comet38";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { TxEventsService } from "@src/modules/chain/services/tx-events-service/tx-events.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(TxEventsService.name, () => {
  describe("getBlockEvents", () => {
    it("should extract certain events from tx logs", async () => {
      const { module } = await setup();
      const service = module.get<TxEventsService>(TxEventsService);
      const cometClient = module.get<MockProxy<Comet38Client>>(Comet38Client);
      const blockResults: BlockResultsResponse = {
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
