#!/usr/bin/env node
import { BasicAllowance, MsgGrantAllowance, MsgRevokeAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { createInterface } from "node:readline";

const USAGE = `Lets addresses deploy on the sandbox E2E provider (provider-01.sandbox-2.aksh.pw), or takes that access away.
The provider only bids for tenants holding a fee grant from the granter wallet; this gives an address a 1uakt grant
that never expires, or revokes it. Granting and revoking ask for the granter mnemonic (hidden input), or read it from stdin.

  npm run sandbox-provider-access -w apps/deploy-web -- <akash1...> [<akash1...> ...]   allow these addresses
  npm run sandbox-provider-access -w apps/deploy-web -- --revoke <akash1...> [...]      remove their access
  npm run sandbox-provider-access -w apps/deploy-web -- --list                          show who is allowed`;

const GRANTER = process.env.EXPECTED_GRANTER ?? "akash1xgt2r8pmte6k6tp8uk62cad9ssjep6m0hlvcy0";
const RPC_URL = "https://rpc.sandbox-2.aksh.pw:443";
const REST_URL = "https://api.sandbox-2.aksh.pw";
/** The 1.4x margin cosmjs uses for "auto" is too tight for revokes, which then run out of gas. */
const GAS_ESTIMATE_MULTIPLIER = 2;
const ADDRESS_PATTERN = /^akash1[02-9ac-hj-np-z]{38}$/;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function fetchIssuedGrants() {
  const response = await fetch(`${REST_URL}/cosmos/feegrant/v1beta1/issued/${GRANTER}?pagination.limit=1000`);
  if (!response.ok) fail(`could not read the granter's grants (HTTP ${response.status})`);
  const { allowances } = await response.json();
  return new Map(allowances.map(grant => [grant.grantee, grant.allowance.expiration ?? null]));
}

async function list() {
  const grants = [...(await fetchIssuedGrants())];
  const permanent = grants.filter(([, expiration]) => !expiration);
  const temporary = grants.filter(([, expiration]) => expiration);
  console.log(`Allowed permanently (${permanent.length}):`);
  for (const [grantee] of permanent) console.log(`  ${grantee}`);
  console.log(`Temporary E2E grants (${temporary.length}):`);
  for (const [grantee, expiration] of temporary) console.log(`  ${grantee}  expires ${expiration}`);
}

function readPipedMnemonic() {
  return new Promise(resolve => {
    let input = "";
    process.stdin.on("data", chunk => (input += chunk));
    process.stdin.on("end", () => resolve(input.trim()));
  });
}

function promptHiddenMnemonic() {
  return new Promise(resolve => {
    const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    prompt._writeToOutput = text => {
      if (!muted) process.stdout.write(text);
    };
    prompt.question("Granter mnemonic (hidden): ", answer => {
      prompt.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
    muted = true;
  });
}

async function connectGranter() {
  const mnemonic = process.stdin.isTTY ? await promptHiddenMnemonic() : await readPipedMnemonic();
  if (!mnemonic) fail("no mnemonic given");

  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "akash" }).catch(() => fail("that is not a valid mnemonic"));
  const [{ address }] = await wallet.getAccounts();
  if (address !== GRANTER) fail(`that mnemonic belongs to ${address}, not the granter ${GRANTER}`);

  return SigningStargateClient.connectWithSigner(RPC_URL, wallet, { gasPrice: GasPrice.fromString("0.025uakt") });
}

function grantMessage(grantee) {
  return {
    typeUrl: `/${MsgGrantAllowance.$type}`,
    value: {
      granter: GRANTER,
      grantee,
      allowance: {
        typeUrl: `/${BasicAllowance.$type}`,
        value: BasicAllowance.encode({ spendLimit: [{ denom: "uakt", amount: "1" }] }).finish()
      }
    }
  };
}

function revokeMessage(grantee) {
  return { typeUrl: `/${MsgRevokeAllowance.$type}`, value: { granter: GRANTER, grantee } };
}

function planAllow(addresses, grants) {
  return addresses.flatMap(address => {
    if (!grants.has(address)) return [grantMessage(address)];

    if (grants.get(address)) {
      console.log(`${address} has a temporary grant; replacing it with a permanent one`);
      return [revokeMessage(address), grantMessage(address)];
    }

    console.log(`${address} is already allowed`);
    return [];
  });
}

function planRevoke(addresses, grants) {
  return addresses.flatMap(address => {
    if (grants.has(address)) return [revokeMessage(address)];

    console.log(`${address} has no grant from the granter; nothing to revoke`);
    return [];
  });
}

async function broadcast(messages) {
  const client = await connectGranter();
  try {
    const result = await client.signAndBroadcast(GRANTER, messages, GAS_ESTIMATE_MULTIPLIER);
    if (result.code !== 0) fail(`transaction failed: ${result.rawLog || `code ${result.code}`}`);
    console.log(`✓ Done in tx ${result.transactionHash}`);
  } finally {
    client.disconnect();
  }
}

const args = process.argv.slice(2);

if (args.includes("--list")) {
  await list();
  process.exit(0);
}

const revoke = args.includes("--revoke");
const addresses = [...new Set(args.filter(arg => arg !== "--revoke"))];
if (addresses.length === 0 || args.includes("--help")) {
  console.log(USAGE);
  process.exit(addresses.length === 0 ? 1 : 0);
}
const invalid = addresses.filter(address => !ADDRESS_PATTERN.test(address));
if (invalid.length > 0) fail(`not valid akash addresses: ${invalid.join(", ")}`);

const grants = await fetchIssuedGrants();
const messages = revoke ? planRevoke(addresses, grants) : planAllow(addresses, grants);
if (messages.length === 0) process.exit(0);

await broadcast(messages);
console.log(revoke ? "Those addresses no longer get bids from the sandbox provider." : "Those addresses now get bids from the sandbox provider.");
