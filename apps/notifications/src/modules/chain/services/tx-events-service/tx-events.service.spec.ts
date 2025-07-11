import type { BlockResultsResponse } from "@cosmjs/tendermint-rpc";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { TxEventsService } from "@src/modules/chain/services/tx-events-service/tx-events.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(TxEventsService.name, () => {
  describe("getBlockEvents", () => {
    it("should extract certain events from tx logs", async () => {
      const { module } = await setup();
      const service = module.get<TxEventsService>(TxEventsService);
      const tendermintClient = module.get<MockProxy<Tendermint34Client>>(Tendermint34Client);
      const blockResults: BlockResultsResponse = {
        height: 22350454,
        results: [
          {
            code: 0,
            codespace: "",
            log: '[{"events":[{"type":"akash.v1","attributes":[{"key":"module","value":"deployment"},{"key":"action","value":"deployment-created"},{"key":"version","value":"f5151c689bad78ce8bfe614bf22c74ee228a0e31d9a4e973adace676833e5219"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350452"},{"key":"module","value":"market"},{"key":"action","value":"order-created"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350452"},{"key":"gseq","value":"1"},{"key":"oseq","value":"1"}]},{"type":"coin_received","attributes":[{"key":"receiver","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"amount","value":"500000uakt"}]},{"type":"coin_spent","attributes":[{"key":"spender","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"amount","value":"500000uakt"}]},{"type":"message","attributes":[{"key":"action","value":"/akash.deployment.v1beta3.MsgCreateDeployment"},{"key":"sender","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"}]},{"type":"transfer","attributes":[{"key":"recipient","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"sender","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"amount","value":"500000uakt"}]}]}]',
            data: Uint8Array.from([]),
            events: [],
            gasWanted: 140139n,
            gasUsed: 110798n
          },
          {
            code: 0,
            codespace: "",
            log: '[{"events":[{"type":"akash.v1","attributes":[{"key":"module","value":"deployment"},{"key":"action","value":"deployment-closed"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350842"},{"key":"module","value":"deployment"},{"key":"action","value":"group-closed"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350842"},{"key":"gseq","value":"1"},{"key":"module","value":"market"},{"key":"action","value":"order-closed"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350842"},{"key":"gseq","value":"1"},{"key":"oseq","value":"1"},{"key":"module","value":"market"},{"key":"action","value":"bid-closed"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350842"},{"key":"gseq","value":"1"},{"key":"oseq","value":"1"},{"key":"provider","value":"akash16lr6sexztap5394wqtqgqt4mfuv7y2welmpjr2"},{"key":"price-denom","value":"uakt"},{"key":"price-amount","value":"0.474215000000000000"},{"key":"module","value":"market"},{"key":"action","value":"lease-closed"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350842"},{"key":"gseq","value":"1"},{"key":"oseq","value":"1"},{"key":"provider","value":"akash16lr6sexztap5394wqtqgqt4mfuv7y2welmpjr2"},{"key":"price-denom","value":"uakt"},{"key":"price-amount","value":"0.474215000000000000"}]},{"type":"coin_received","attributes":[{"key":"receiver","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"amount","value":"499997uakt"},{"key":"receiver","value":"akash16lr6sexztap5394wqtqgqt4mfuv7y2welmpjr2"},{"key":"amount","value":"2uakt"},{"key":"receiver","value":"akash16lr6sexztap5394wqtqgqt4mfuv7y2welmpjr2"},{"key":"amount","value":"500000uakt"}]},{"type":"coin_spent","attributes":[{"key":"spender","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"amount","value":"499997uakt"},{"key":"spender","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"amount","value":"2uakt"},{"key":"spender","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"amount","value":"500000uakt"}]},{"type":"message","attributes":[{"key":"action","value":"/akash.deployment.v1beta3.MsgCloseDeployment"},{"key":"sender","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"sender","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"sender","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"}]},{"type":"transfer","attributes":[{"key":"recipient","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"sender","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"amount","value":"499997uakt"},{"key":"recipient","value":"akash16lr6sexztap5394wqtqgqt4mfuv7y2welmpjr2"},{"key":"sender","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"amount","value":"2uakt"},{"key":"recipient","value":"akash16lr6sexztap5394wqtqgqt4mfuv7y2welmpjr2"},{"key":"sender","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"amount","value":"500000uakt"}]}]}]',
            data: Uint8Array.from([]),
            events: [],
            gasWanted: 321803n,
            gasUsed: 240558n
          },
          {
            code: 0,
            codespace: "",
            log: '[{"events":[{"type":"akash.v1","attributes":[{"key":"module","value":"deployment"},{"key":"action","value":"deployment-created"},{"key":"version","value":"f5151c689bad78ce8bfe614bf22c74ee228a0e31d9a4e973adace676833e5219"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350453"},{"key":"module","value":"market"},{"key":"action","value":"order-created"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350452"},{"key":"gseq","value":"1"},{"key":"oseq","value":"1"},{"key":"module","value":"deployment"},{"key":"action","value":"deployment-closed"},{"key":"owner","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"dseq","value":"22350843"}]},{"type":"coin_received","attributes":[{"key":"receiver","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"amount","value":"500000uakt"}]},{"type":"coin_spent","attributes":[{"key":"spender","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"amount","value":"500000uakt"}]},{"type":"message","attributes":[{"key":"action","value":"/akash.deployment.v1beta3.MsgCreateDeployment"},{"key":"sender","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"}]},{"type":"transfer","attributes":[{"key":"recipient","value":"akash14pphss726thpwws3yc458hggufynm9x77l4l2u"},{"key":"sender","value":"akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcyd"},{"key":"amount","value":"500000uakt"}]}]}]',
            data: Uint8Array.from([]),
            events: [],
            gasWanted: 321803n,
            gasUsed: 240558n
          }
        ],
        validatorUpdates: [],
        consensusUpdates: {
          block: { maxBytes: 22020096, maxGas: -1 },
          evidence: { maxAgeNumBlocks: 279138, maxAgeDuration: 1814400000000000 }
        },
        beginBlockEvents: [],
        endBlockEvents: []
      };
      tendermintClient.blockResults.mockResolvedValue(blockResults);
      const result = await service.getBlockEvents(22350454, { type: "akash.v1", action: ["deployment-created", "deployment-closed"] });

      expect(result).toEqual([
        {
          type: "akash.v1",
          module: "deployment",
          action: "deployment-created",
          version: "f5151c689bad78ce8bfe614bf22c74ee228a0e31d9a4e973adace676833e5219",
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
          version: "f5151c689bad78ce8bfe614bf22c74ee228a0e31d9a4e973adace676833e5219",
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
      providers: [TxEventsService, { provide: Tendermint34Client, useValue: mock<Tendermint34Client>() }, MockProvider(LoggerService)]
    }).compile();

    return {
      module
    };
  }
});
