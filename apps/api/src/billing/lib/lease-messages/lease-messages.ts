import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { Bid, BidHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import assert from "http-assert";

type LeaseBidId = NonNullable<MsgCreateLease["bidId"]>;

/**
 * A lease bid id paired with the bids it resolves to: the full set of bids on the same
 * order (`orderBids`, useful for peer comparisons) and the specific `accepted` bid the
 * lease message references.
 */
export interface ResolvedLeaseBid {
  bidId: LeaseBidId;
  orderBids: Bid[];
  accepted: Bid;
}

/**
 * Extracts the bid IDs from every MsgCreateLease message in a decoded transaction.
 * A MsgCreateLease references the bid being accepted via its bidId; messages of any
 * other type are ignored.
 */
export function getLeaseBidIds(messages: EncodeObject[]): LeaseBidId[] {
  return messages
    .filter(message => message.typeUrl === `/${MsgCreateLease.$type}`)
    .map(message => (message.value as MsgCreateLease).bidId)
    .filter((id): id is LeaseBidId => !!id);
}

/**
 * Resolves every MsgCreateLease bid id in a transaction to its on-chain bids.
 *
 * A MsgCreateLease only references a bid, so the bids for each referenced order are fetched
 * (deduplicated by dseq, in parallel) and the accepted bid is matched within its order. Throws
 * 403 if a referenced bid cannot be found. Returns an empty list when there are no lease messages.
 */
export async function resolveLeaseBids(messages: EncodeObject[], owner: string, bidHttpService: BidHttpService): Promise<ResolvedLeaseBid[]> {
  const leaseBidIds = getLeaseBidIds(messages);
  if (leaseBidIds.length === 0) return [];

  const uniqueDseqs = Array.from(new Set(leaseBidIds.map(id => id.dseq.toString())));
  const bidsByDseq = new Map<string, Bid[]>();
  await Promise.all(
    uniqueDseqs.map(async dseq => {
      bidsByDseq.set(dseq, await bidHttpService.list(owner, dseq));
    })
  );

  return leaseBidIds.map(bidId => {
    const orderBids = bidsByDseq.get(bidId.dseq.toString()) ?? [];
    const accepted = orderBids.find(
      b =>
        b.bid.id.owner === bidId.owner &&
        b.bid.id.gseq === bidId.gseq &&
        b.bid.id.oseq === bidId.oseq &&
        b.bid.id.provider === bidId.provider &&
        b.bid.id.bseq === bidId.bseq
    );
    assert(
      accepted,
      403,
      `Referenced lease bid not found: dseq=${bidId.dseq}, gseq=${bidId.gseq}, oseq=${bidId.oseq}, provider=${bidId.provider}, bseq=${bidId.bseq}`
    );
    return { bidId, orderBids, accepted };
  });
}
