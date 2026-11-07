import { MsgCreateBid as MsgCreateBidV4 } from "@akashnetwork/akash-api/akash/market/v1beta4";
import { MsgCreateBid as MsgCreateBidV5 } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { Registry } from "@src/billing/providers/type-registry.provider";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { decodeGpuBid, getGpusFromAttributes } from "./gpu-bid-decoder";

const H100_ATTRIBUTE = { key: "vendor/nvidia/model/h100/ram/80Gi/interface/sxm5", value: "true" };
const H100 = { vendor: "nvidia", model: "h100", ram: "80Gi", interface: "sxm5" };

describe(decodeGpuBid.name, () => {
  describe("when the bid is a v1beta5 message", () => {
    it("reads the provider, order, price and gpus from the bid id", () => {
      const { typeRegistry } = setup();
      const message = createV5Bid({ provider: "akash1provider", gseq: 2, oseq: 3, denom: "uact", amount: "1500.5", gpuAttributes: [H100_ATTRIBUTE] });

      const bid = decodeGpuBid(typeRegistry, message);

      expect(bid).toMatchObject({ provider: "akash1provider", gseq: 2, oseq: 3, denom: "uact", amountPerBlock: 1500.5, gpus: [H100] });
    });

    it("sums the cpu, memory and storage of every offered resource", () => {
      const { typeRegistry } = setup();
      const message = createV5Bid({
        resources: [
          { cpu: 100, memory: 1024, storage: [2048, 4096], gpuUnits: 1 },
          { cpu: 250, memory: 512, storage: [], gpuUnits: 0 }
        ]
      });

      const bid = decodeGpuBid(typeRegistry, message);

      expect(bid).toMatchObject({ cpuUnits: 350, memoryUnits: 1536, storageUnits: 6144 });
    });

    it("keeps a JSON-serializable copy of the message", () => {
      const { typeRegistry } = setup();
      const message = createV5Bid({ provider: "akash1provider" });

      const bid = decodeGpuBid(typeRegistry, message);

      expect(JSON.parse(JSON.stringify(bid.json))).toMatchObject({ id: { provider: "akash1provider" } });
    });

    it("leaves out gpus offered on resources without gpu units", () => {
      const { typeRegistry } = setup();
      const message = createV5Bid({ resources: [{ cpu: 100, memory: 1024, storage: [], gpuUnits: 0 }], gpuAttributes: [H100_ATTRIBUTE] });

      const bid = decodeGpuBid(typeRegistry, message);

      expect(bid.gpus).toEqual([]);
    });

    it("counts an offer without resources as zero of everything", () => {
      const { typeRegistry } = setup();
      const bid = MsgCreateBidV5.fromPartial({ id: { provider: "akash1provider" }, resourcesOffer: [{ count: 1 }] });
      const message = { type: "/akash.market.v1beta5.MsgCreateBid", data: MsgCreateBidV5.encode(bid).finish() };

      const decoded = decodeGpuBid(typeRegistry, message);

      expect(decoded).toMatchObject({ gpus: [], cpuUnits: 0, memoryUnits: 0, storageUnits: 0 });
    });

    it("falls back to empty identity fields when the bid has no id", () => {
      const { typeRegistry } = setup();
      const message = { type: "/akash.market.v1beta5.MsgCreateBid", data: MsgCreateBidV5.encode(MsgCreateBidV5.fromPartial({})).finish() };

      const bid = decodeGpuBid(typeRegistry, message);

      expect(bid).toMatchObject({ provider: "", gseq: 0, oseq: 0, denom: undefined, gpus: [], cpuUnits: 0, memoryUnits: 0, storageUnits: 0 });
      expect(bid.amountPerBlock).toBeNaN();
    });
  });

  describe("when the bid is a v1beta4 message", () => {
    it("reads the provider from the bid and the order from its order id", () => {
      const { typeRegistry } = setup();
      const message = createV4Bid({ provider: "akash1provider", gseq: 4, oseq: 5, denom: "uakt", amount: "42", cpu: 100, memory: 1024, storage: 2048 });

      const bid = decodeGpuBid(typeRegistry, message);

      expect(bid).toMatchObject({
        provider: "akash1provider",
        gseq: 4,
        oseq: 5,
        denom: "uakt",
        amountPerBlock: 42,
        gpus: [H100],
        cpuUnits: 100,
        memoryUnits: 1024,
        storageUnits: 2048
      });
      expect(JSON.parse(JSON.stringify(bid.json))).toMatchObject({ provider: "akash1provider" });
    });

    it("falls back to empty identity fields when the bid has no order or provider", () => {
      const { typeRegistry } = setup();
      const message = { type: "/akash.market.v1beta4.MsgCreateBid", data: MsgCreateBidV4.encode(MsgCreateBidV4.fromPartial({})).finish() };

      const bid = decodeGpuBid(typeRegistry, message);

      expect(bid).toMatchObject({ provider: "", gseq: 0, oseq: 0, gpus: [] });
    });
  });

  function setup() {
    return { typeRegistry: container.createChildContainer().resolve<Registry>(TYPE_REGISTRY) };
  }

  function createV5Bid(input: {
    provider?: string;
    gseq?: number;
    oseq?: number;
    denom?: string;
    amount?: string;
    gpuAttributes?: { key: string; value: string }[];
    resources?: { cpu: number; memory: number; storage: number[]; gpuUnits: number }[];
  }) {
    const resources = input.resources ?? [{ cpu: 100, memory: 1024, storage: [2048], gpuUnits: 1 }];
    const bid = MsgCreateBidV5.fromPartial({
      id: { owner: "akash1owner", dseq: 1, gseq: input.gseq ?? 1, oseq: input.oseq ?? 1, bseq: 0, provider: input.provider ?? "akash1provider" },
      price: { denom: input.denom ?? "uakt", amount: input.amount ?? "100" },
      resourcesOffer: resources.map((resource, index) => ({
        resources: {
          id: index + 1,
          cpu: { units: { val: BigInt(resource.cpu) }, attributes: [] },
          memory: { quantity: { val: BigInt(resource.memory) }, attributes: [] },
          storage: resource.storage.map(size => ({ name: "default", quantity: { val: BigInt(size) }, attributes: [] })),
          gpu: { units: { val: BigInt(resource.gpuUnits) }, attributes: input.gpuAttributes ?? [H100_ATTRIBUTE] },
          endpoints: []
        },
        count: 1
      }))
    });

    return { type: "/akash.market.v1beta5.MsgCreateBid", data: MsgCreateBidV5.encode(bid).finish() };
  }

  function createV4Bid(input: { provider: string; gseq: number; oseq: number; denom: string; amount: string; cpu: number; memory: number; storage: number }) {
    const encode = (value: number) => new TextEncoder().encode(value.toString());
    const bid = MsgCreateBidV4.fromPartial({
      order: { owner: "akash1owner", dseq: 1, gseq: input.gseq, oseq: input.oseq },
      provider: input.provider,
      price: { denom: input.denom, amount: input.amount },
      resourcesOffer: [
        {
          resources: {
            id: 1,
            cpu: { units: { val: encode(input.cpu) }, attributes: [] },
            memory: { quantity: { val: encode(input.memory) }, attributes: [] },
            storage: [{ name: "default", quantity: { val: encode(input.storage) }, attributes: [] }],
            gpu: { units: { val: encode(1) }, attributes: [H100_ATTRIBUTE] },
            endpoints: []
          },
          count: 1
        }
      ]
    });

    return { type: "/akash.market.v1beta4.MsgCreateBid", data: MsgCreateBidV4.encode(bid).finish() };
  }
});

describe(getGpusFromAttributes.name, () => {
  it("reads vendor, model, ram and interface from each enabled gpu attribute", () => {
    expect(getGpusFromAttributes([H100_ATTRIBUTE, { key: "vendor/nvidia/model/a100/ram/40Gi/interface/pcie", value: "true" }])).toEqual([
      H100,
      { vendor: "nvidia", model: "a100", ram: "40Gi", interface: "pcie" }
    ]);
  });

  it("leaves missing parts undefined", () => {
    expect(getGpusFromAttributes([{ key: "vendor/nvidia/model/rtx4090", value: "true" }])).toEqual([
      { vendor: "nvidia", model: "rtx4090", ram: undefined, interface: undefined }
    ]);
  });

  it("skips attributes that are disabled or are not gpu vendors", () => {
    expect(
      getGpusFromAttributes([
        { key: "vendor/nvidia/model/h100", value: "false" },
        { key: "capabilities/storage/1/class", value: "true" },
        { key: "region/vendor/nvidia", value: "true" }
      ])
    ).toEqual([]);
  });
});
