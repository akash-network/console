import { DepositAuthorization, DepositAuthorization_Scope, MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgGrant, MsgRevoke } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import { TransactionEvent, TransactionEventAttribute } from "@akashnetwork/database/dbSchemas/base";
import { faker } from "@faker-js/faker";

import { createAkashAddress } from "./akash-address.seeder";
import { createAkashBlock } from "./akash-block.seeder";
import { createAkashMessage } from "./akash-message.seeder";
import { createTransaction } from "./transaction.seeder";

const DEPOSIT_GRANT_MSG_TYPE_URL = `/${MsgAccountDeposit.$type}`;

type IndexedAt = { height: number; txIndex?: number; at?: Date; hash?: string; hasProcessingError?: boolean };

type IndexedEvent = { type: string; attributes: [string, string][] };

/** The funding wallet's grant of `limit` to the grantee, stored the way the chain index stores it. */
export async function indexAllowanceGrant({
  granter,
  grantee,
  denom,
  limit,
  ...at
}: IndexedAt & { granter: string; grantee: string; denom: string; limit: number }) {
  const data = MsgGrant.encode({
    granter,
    grantee,
    grant: {
      authorization: {
        typeUrl: `/${DepositAuthorization.$type}`,
        value: DepositAuthorization.encode(
          DepositAuthorization.fromPartial({
            spendLimit: { denom, amount: "0" },
            spendLimits: [{ denom, amount: String(limit) }],
            scopes: [DepositAuthorization_Scope.deployment]
          })
        ).finish()
      },
      expiration: undefined
    }
  }).finish();

  return await indexTx(at, { type: `/${MsgGrant.$type}`, data }, [grantEvent("EventGrant", { granter, grantee })]);
}

export async function indexAllowanceRevoke({ granter, grantee, ...at }: IndexedAt & { granter: string; grantee: string }) {
  const data = MsgRevoke.encode({ granter, grantee, msgTypeUrl: DEPOSIT_GRANT_MSG_TYPE_URL }).finish();

  return await indexTx(at, { type: `/${MsgRevoke.$type}`, data }, [grantEvent("EventRevoke", { granter, grantee })]);
}

/** A deposit by the grantee that drew `amount` on the granter's grant, next to the fee the granter paid for it; the escrow module saves a used-up grant rather than deleting it. */
export async function indexGrantFundedDeposit({
  granter,
  grantee,
  denom,
  amount,
  ...at
}: IndexedAt & { granter: string; grantee: string; denom: string; amount: number }) {
  return await indexTx(at, { type: DEPOSIT_GRANT_MSG_TYPE_URL, data: new Uint8Array([1]) }, [
    feePaidBy(granter),
    grantEvent("EventGrant", { granter, grantee }),
    {
      type: "coin_spent",
      attributes: [
        ["spender", granter],
        ["amount", `${amount}${denom}`],
        ["msg_index", "0"]
      ]
    }
  ]);
}

/** A closing deployment of the grantee whose escrow returned `amount` of the granter's unspent deposit and added it back to the grant. */
export async function indexGrantRefund({
  granter,
  grantee,
  denom,
  amount,
  ...at
}: IndexedAt & { granter: string; grantee: string; denom: string; amount: number }) {
  const escrowModule = createAkashAddress();

  return await indexTx(at, { type: `/${MsgCloseDeployment.$type}`, data: new Uint8Array([1]) }, [
    feePaidBy(granter),
    {
      type: "coin_spent",
      attributes: [
        ["spender", escrowModule],
        ["amount", `${amount}${denom}`],
        ["msg_index", "0"]
      ]
    },
    {
      type: "coin_received",
      attributes: [
        ["receiver", granter],
        ["amount", `${amount}${denom}`],
        ["msg_index", "0"]
      ]
    },
    grantEvent("EventGrant", { granter, grantee })
  ]);
}

/** A deposit the grantee paid from its own balance, which leaves the granter's grant alone. */
export async function indexBalanceFundedDeposit({ grantee, denom, amount, ...at }: IndexedAt & { grantee: string; denom: string; amount: number }) {
  return await indexTx(at, { type: DEPOSIT_GRANT_MSG_TYPE_URL, data: new Uint8Array([1]) }, [
    {
      type: "coin_spent",
      attributes: [
        ["spender", grantee],
        ["amount", `${amount}${denom}`],
        ["msg_index", "0"]
      ]
    }
  ]);
}

let eventTablesSynced: Promise<void> | undefined;

/** The indexer creates these tables by syncing its models at startup rather than through the migrations the test database is built from. */
export async function ensureTransactionEventTables(): Promise<void> {
  eventTablesSynced ??= (async () => {
    await TransactionEvent.sync();
    await TransactionEventAttribute.sync();
  })();

  await eventTablesSynced;
}

export async function indexBlock(height: number, at: Date = new Date()) {
  const block = await AkashBlock.findByPk(height);

  return block ?? (await createAkashBlock({ height, datetime: at }));
}

function feePaidBy(payer: string): IndexedEvent {
  return {
    type: "coin_spent",
    attributes: [
      ["spender", payer],
      ["amount", "5000uakt"]
    ]
  };
}

function grantEvent(name: "EventGrant" | "EventRevoke", { granter, grantee }: { granter: string; grantee: string }): IndexedEvent {
  return {
    type: `cosmos.authz.v1beta1.${name}`,
    attributes: [
      ["grantee", JSON.stringify(grantee)],
      ["granter", JSON.stringify(granter)],
      ["msg_type_url", JSON.stringify(DEPOSIT_GRANT_MSG_TYPE_URL)],
      ["msg_index", "0"]
    ]
  };
}

async function indexTx(
  { height, txIndex = 0, at, hash = faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase(), hasProcessingError = false }: IndexedAt,
  message: { type: string; data: Uint8Array },
  events: IndexedEvent[]
) {
  await indexBlock(height, at);
  const transaction = await createTransaction({ height, index: txIndex, hash, hasProcessingError });
  await createAkashMessage({ txId: transaction.id, height, index: 0, type: message.type, data: Buffer.from(message.data) });

  for (const [index, event] of events.entries()) {
    const { id } = await TransactionEvent.create({ id: faker.string.uuid(), height, txId: transaction.id, index, type: event.type });
    await TransactionEventAttribute.bulkCreate(
      event.attributes.map(([key, value], attributeIndex) => ({ id: faker.string.uuid(), transactionEventId: id, index: attributeIndex, key, value }))
    );
  }

  return hash;
}
