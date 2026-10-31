import type { AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { Provider, ProviderAttribute, ProviderAttributeSignature } from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction as DbTransaction } from "sequelize";
import { Op } from "sequelize";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AkashStatsIndexer } from "./akashStatsIndexer";

const OVERSIZED = "x".repeat(300);
const CAPPED = "x".repeat(255);

describe(AkashStatsIndexer.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when a provider message carries values its columns refuse", () => {
    it("stores a created provider with NUL characters removed and long values capped", async () => {
      const { indexer, transaction } = setup();
      const create = vi.spyOn(Provider, "create").mockResolvedValue(mock<Provider>());
      const bulkCreate = vi.spyOn(ProviderAttribute, "bulkCreate").mockResolvedValue([]);

      await indexer.processMessage(
        {
          owner: "akash1owner",
          hostUri: `https://${OVERSIZED}`,
          info: { email: "ops\0@example.com", website: OVERSIZED },
          attributes: [{ key: "region", value: "us-west\0" }]
        },
        100,
        transaction,
        message("/akash.provider.v1beta4.MsgCreateProvider")
      );

      expect(create).toHaveBeenCalledWith(
        { owner: "akash1owner", hostUri: `https://${"x".repeat(247)}`, createdHeight: 100, email: "ops@example.com", website: CAPPED },
        { transaction }
      );
      expect(bulkCreate).toHaveBeenCalledWith([{ provider: "akash1owner", key: "region", value: "us-west" }], { transaction });
    });

    it("stores an updated provider with NUL characters removed and long values capped", async () => {
      const { indexer, transaction } = setup();
      const update = vi.spyOn(Provider, "update").mockResolvedValue([1]);
      vi.spyOn(ProviderAttribute, "destroy").mockResolvedValue(1);
      const bulkCreate = vi.spyOn(ProviderAttribute, "bulkCreate").mockResolvedValue([]);

      await indexer.processMessage(
        {
          owner: "akash1owner",
          hostUri: "https://provider.example.com:8443",
          info: { email: OVERSIZED, website: "https://example.com/\0" },
          attributes: [{ key: "tier", value: OVERSIZED }]
        },
        101,
        transaction,
        message("/akash.provider.v1beta4.MsgUpdateProvider")
      );

      expect(update).toHaveBeenCalledWith(
        { hostUri: "https://provider.example.com:8443", updatedHeight: 101, email: CAPPED, website: "https://example.com/" },
        { where: { owner: "akash1owner" }, transaction }
      );
      expect(bulkCreate).toHaveBeenCalledWith([{ provider: "akash1owner", key: "tier", value: CAPPED }], { transaction });
    });

    it("keeps an updated provider without contact info without contact info", async () => {
      const { indexer, transaction } = setup();
      const update = vi.spyOn(Provider, "update").mockResolvedValue([1]);
      vi.spyOn(ProviderAttribute, "destroy").mockResolvedValue(1);
      vi.spyOn(ProviderAttribute, "bulkCreate").mockResolvedValue([]);

      await indexer.processMessage(
        { owner: "akash1owner", hostUri: "https://provider.example.com:8443", attributes: [] },
        103,
        transaction,
        message("/akash.provider.v1beta4.MsgUpdateProvider")
      );

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ email: undefined, website: undefined }), expect.anything());
    });

    it("keeps a provider without contact info without contact info", async () => {
      const { indexer, transaction } = setup();
      const create = vi.spyOn(Provider, "create").mockResolvedValue(mock<Provider>());
      vi.spyOn(ProviderAttribute, "bulkCreate").mockResolvedValue([]);

      await indexer.processMessage(
        { owner: "akash1owner", hostUri: "https://provider.example.com:8443", attributes: [] },
        102,
        transaction,
        message("/akash.provider.v1beta4.MsgCreateProvider")
      );

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ email: undefined, website: undefined }), { transaction });
    });
  });

  describe("when an audit message carries values its columns refuse", () => {
    it("looks up and stores a new signed attribute by its cleaned key and value", async () => {
      const { indexer, transaction } = setup();
      vi.spyOn(Provider, "findOne").mockResolvedValue(mock<Provider>());
      const findOne = vi.spyOn(ProviderAttributeSignature, "findOne").mockResolvedValue(null);
      const create = vi.spyOn(ProviderAttributeSignature, "create").mockResolvedValue(mock<ProviderAttributeSignature>());

      await indexer.processMessage(
        { owner: "akash1owner", auditor: "akash1auditor", attributes: [{ key: `${OVERSIZED}\0`, value: "gpu\0" }] },
        103,
        transaction,
        message("/akash.audit.v1.MsgSignProviderAttributes")
      );

      expect(findOne).toHaveBeenCalledWith({ where: { provider: "akash1owner", auditor: "akash1auditor", key: CAPPED }, transaction });
      expect(create).toHaveBeenCalledWith({ provider: "akash1owner", auditor: "akash1auditor", key: CAPPED, value: "gpu" }, { transaction });
    });

    it("updates an existing signed attribute with its cleaned value", async () => {
      const { indexer, transaction } = setup();
      const existingSignature = mock<ProviderAttributeSignature>();
      vi.spyOn(Provider, "findOne").mockResolvedValue(mock<Provider>());
      vi.spyOn(ProviderAttributeSignature, "findOne").mockResolvedValue(existingSignature);

      await indexer.processMessage(
        { owner: "akash1owner", auditor: "akash1auditor", attributes: [{ key: "tier", value: OVERSIZED }] },
        104,
        transaction,
        message("/akash.audit.v1.MsgSignProviderAttributes")
      );

      expect(existingSignature.update).toHaveBeenCalledWith({ value: CAPPED }, { transaction });
    });

    it("deletes signed attributes by their cleaned keys", async () => {
      const { indexer, transaction } = setup();
      const destroy = vi.spyOn(ProviderAttributeSignature, "destroy").mockResolvedValue(1);

      await indexer.processMessage(
        { owner: "akash1owner", auditor: "akash1auditor", keys: ["tier\0", OVERSIZED] },
        105,
        transaction,
        message("/akash.audit.v1.MsgDeleteProviderAttributes")
      );

      expect(destroy).toHaveBeenCalledWith({
        where: { provider: "akash1owner", auditor: "akash1auditor", key: { [Op.in]: ["tier", CAPPED] } },
        transaction
      });
    });
  });

  function setup() {
    const indexer = new AkashStatsIndexer();
    const transaction = mock<DbTransaction>();

    return { indexer, transaction };
  }
});

function message(type: string) {
  return mock<Message>({ type, id: "message-id", txId: "tx-id" });
}
