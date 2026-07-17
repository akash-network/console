/**
 * Akash Console — x402 USDC top-up example (agent client).
 *
 * End-to-end loop:
 *   1. POST /v1/x402/top-up?amount=<usd>            -> 402 Payment Required (the challenge)
 *   2. sign the challenge with your wallet           -> X-PAYMENT header
 *   3. POST again with X-PAYMENT                      -> 200, payment settles on-chain and credits Console
 *   4. GET /v1/x402/transactions                      -> read your own history back, print the transactionId
 *
 * Defaults are Base Sepolia testnet so a copy-paste run can never spend mainnet USDC.
 * Run:  node --env-file=.env top-up.ts        (Node >= 24 strips the TypeScript types natively)
 *   or: npx tsx top-up.ts
 *
 * You must fund the wallet at PRIVATE_KEY with Base Sepolia testnet USDC + a little ETH for gas first.
 * See README.md for the faucet + funding steps.
 */
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const API_BASE = process.env.CONSOLE_API_BASE ?? "https://console-api-sandbox.akash.network";
const API_TOKEN = requireEnv("CONSOLE_API_TOKEN");
const PRIVATE_KEY = requireEnv("X402_PRIVATE_KEY") as `0x${string}`;
const AMOUNT_USD = process.env.AMOUNT_USD ?? "5";
// CAIP-2 chain ids that move real money. Refuse to sign for these unless explicitly opted in.
const MAINNET_NETWORKS = new Set(["eip155:8453", "eip155:1", "eip155:137", "eip155:42161", "eip155:10"]);
const ALLOW_MAINNET = process.env.X402_ALLOW_MAINNET === "true";

async function main(): Promise<void> {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  const http = new x402HTTPClient(client);

  const url = `${API_BASE}/v1/x402/top-up?amount=${AMOUNT_USD}`;
  const authHeaders = { authorization: `Bearer ${API_TOKEN}` };

  console.log(`Wallet ${account.address} requesting a $${AMOUNT_USD} top-up at ${url}`);

  // 1. Trigger the 402 challenge (no X-PAYMENT header attached).
  const challenge = await fetch(url, { method: "POST", headers: authHeaders });

  if (challenge.status !== 402) {
    throw new Error(`Expected 402 Payment Required, got ${challenge.status}: ${await challenge.text()}`);
  }

  const challengeBody: unknown = await challenge.json();
  const paymentRequired = http.getPaymentRequiredResponse(name => challenge.headers.get(name), challengeBody);

  const [firstOption] = paymentRequired.accepts;
  if (!firstOption) {
    throw new Error("402 challenge advertised no accepted payment requirements");
  }

  console.log(`Server accepts: ${firstOption.amount} of ${firstOption.asset} on ${firstOption.network} -> ${firstOption.payTo}`);

  if (MAINNET_NETWORKS.has(firstOption.network) && !ALLOW_MAINNET) {
    throw new Error(
      `Refusing to sign a payment on mainnet network ${firstOption.network}. ` +
        `This example defaults to testnet. Set X402_ALLOW_MAINNET=true to override (spends real USDC).`
    );
  }

  // 2. Sign the payment authorization and encode it as the X-PAYMENT header.
  const payload = await http.createPaymentPayload(paymentRequired);
  const paymentHeaders = http.encodePaymentSignatureHeader(payload);

  // 3. Retry with the signed payment: this settles on-chain and credits the Console balance.
  const paid = await fetch(url, { method: "POST", headers: { ...authHeaders, ...paymentHeaders } });
  const paidBody: unknown = await paid.json();

  if (paid.status !== 200) {
    const code = extractString(paidBody, "code");
    throw new Error(`Top-up failed (${paid.status}${code ? `, code=${code}` : ""}): ${JSON.stringify(paidBody)}`);
  }

  const settledTransactionId = extractString(getData(paidBody), "transactionId");
  console.log(`Payment settled. transactionId=${settledTransactionId ?? "(unknown)"}`);

  // 4. Read your own top-up history back and confirm the transaction landed as "succeeded".
  const transaction = await pollForTransaction(authHeaders, settledTransactionId);

  if (!transaction) {
    console.warn("Payment settled but the transaction was not visible on /v1/x402/transactions yet; retry the poll later.");
    return;
  }

  console.log("Read-back from GET /v1/x402/transactions:");
  console.log(JSON.stringify(transaction, null, 2));
  console.log(`\nDone. transactionId=${transaction.transactionId} status=${transaction.status}`);
}

interface TransactionRow {
  transactionId: string;
  status: string;
  amountUsdCents: number;
  network: string;
  settlementTxHash: string | null;
  createdAt: string;
}

async function pollForTransaction(authHeaders: Record<string, string>, transactionId: string | undefined): Promise<TransactionRow | undefined> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch(`${API_BASE}/v1/x402/transactions?limit=25&offset=0`, { headers: authHeaders });

    if (res.status === 200) {
      const body = (await res.json()) as { data?: TransactionRow[] };
      const rows = body.data ?? [];
      const match = transactionId ? rows.find(row => row.transactionId === transactionId) : rows[0];

      if (match && (match.status === "succeeded" || match.status === "settled")) {
        return match;
      }
    }

    await sleep(1500);
  }

  return undefined;
}

function getData(body: unknown): unknown {
  return body && typeof body === "object" && "data" in body ? (body as { data: unknown }).data : undefined;
}

function extractString(value: unknown, key: string): string | undefined {
  if (value && typeof value === "object" && key in value) {
    const field = (value as Record<string, unknown>)[key];
    return typeof field === "string" ? field : undefined;
  }
  return undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
