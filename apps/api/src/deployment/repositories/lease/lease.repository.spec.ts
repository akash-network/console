import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { describe, expect, it, vi } from "vitest";

import { LeaseRepository } from "./lease.repository";

vi.mock("@akashnetwork/database/dbSchemas/akash", () => ({
  Lease: {
    findAll: vi.fn(),
    findAndCountAll: vi.fn()
  }
}));

describe(LeaseRepository.name, () => {
  describe("findActiveDseqsByOwner", () => {
    it("returns empty set when dseqs is empty", async () => {
      const { repo } = setup();
      const result = await repo.findActiveDseqsByOwner("owner1", []);
      expect(result).toEqual(new Set());
      expect(Lease.findAll).not.toHaveBeenCalled();
    });

    it("returns set of active dseqs", async () => {
      const { repo } = setup();
      vi.mocked(Lease.findAll).mockResolvedValue([{ dseq: "100" }, { dseq: "200" }] as never);

      const result = await repo.findActiveDseqsByOwner("owner1", ["100", "200", "300"]);

      expect(result).toEqual(new Set(["100", "200"]));
      expect(Lease.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ owner: "owner1", closedHeight: null }),
          raw: true
        })
      );
    });
  });

  describe("findManyByDseqAndOwner", () => {
    it("returns empty result when dseqs is empty", async () => {
      const { repo } = setup();
      const result = await repo.findManyByDseqAndOwner(1000000, "owner1", []);
      expect(result).toEqual({ drainingDeployments: [], activeDseqs: new Set() });
      expect(Lease.findAll).not.toHaveBeenCalled();
    });

    it("returns draining deployments and active dseqs", async () => {
      const { repo } = setup();
      const drainingLease = { dseq: 100, owner: "owner1", denom: "uakt", predictedClosedHeight: 999000, closedHeight: null, blockRate: 50 };

      vi.mocked(Lease.findAll)
        .mockResolvedValueOnce([drainingLease] as never)
        .mockResolvedValueOnce([{ dseq: "100" }, { dseq: "200" }] as never);

      const result = await repo.findManyByDseqAndOwner(1000000, "owner1", ["100", "200"]);

      expect(result.drainingDeployments).toEqual([drainingLease]);
      expect(result.activeDseqs).toEqual(new Set(["100", "200"]));
    });

    it("handles single object result from findAll", async () => {
      const { repo } = setup();
      const singleLease = { dseq: 100, owner: "owner1", denom: "uakt", predictedClosedHeight: 999000, closedHeight: null, blockRate: 50 };

      vi.mocked(Lease.findAll)
        .mockResolvedValueOnce(singleLease as never)
        .mockResolvedValueOnce([{ dseq: "100" }] as never);

      const result = await repo.findManyByDseqAndOwner(1000000, "owner1", ["100"]);

      expect(result.drainingDeployments).toEqual([singleLease]);
    });

    it("handles null/undefined result from findAll", async () => {
      const { repo } = setup();
      vi.mocked(Lease.findAll)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce([] as never);

      const result = await repo.findManyByDseqAndOwner(1000000, "owner1", ["100"]);

      expect(result.drainingDeployments).toEqual([]);
    });
  });

  function setup() {
    vi.clearAllMocks();
    const repo = new LeaseRepository();
    return { repo };
  }
});
