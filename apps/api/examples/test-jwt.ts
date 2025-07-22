import { MsgCreateDeployment, MsgCloseDeployment, MsgUpdateDeployment } from "@akashnetwork/akash-api/akash/deployment/v1beta3";
import { MsgCreateLease } from "@akashnetwork/akash-api/akash/market/v1beta4";
import { SDL } from '@akashnetwork/akashjs/build/sdl';
import { createCertificate, broadcastCertificate, CertificatePemDeprecated } from '@akashnetwork/akashjs/build/certificates';
import { createSignArbitraryAkashWallet, JwtToken, SignArbitraryAkashWallet } from '@akashnetwork/jwt';
import { DirectSecp256k1HdWallet, Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { MsgUnjail } from "cosmjs-types/cosmos/slashing/v1beta1/tx";
import * as fs from "node:fs";
import * as path from "node:path";
import '@akashnetwork/env-loader';
import { MsgCreateCertificate } from "@akashnetwork/akash-api/akash/cert/v1beta3";
import https from 'node:https';
import { Readable } from "stream";
import WebSocket from 'ws';
import { setTimeout as wait } from 'node:timers/promises';

const CLOSE_DEPLOYMENT_DELAY = 1_000;

const SHOULD_KEEP_DEPLOYMENT = process.env.SHOULD_KEEP_DEPLOYMENT === 'true';
const SDL_YAML = fs.readFileSync(path.resolve(__dirname, "./hello-world-sdl.yml"), "utf8");
const RPC_URL = 'https://rpc.sandbox-01.aksh.pw:443';
const API_URL = 'https://api.sandbox-01.aksh.pw:443'

const PROVIDER_HOST = 'https://provider.provider-02.sandbox-01.aksh.pw:8443';
const PROVIDER_WALLET = "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh";
// const PROVIDER_HOST = 'http://provider.europlots-sandbox.com:8443';
// const PROVIDER_WALLET = 'akash1d4fletej4cwn9x8jzpzmnk6zkqeh90ejjskpmu';
const AUTH_TYPE: 'jwt' | 'mtls' = 'jwt';

async function main() {
  const providerUrl = new URL(PROVIDER_HOST);
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(process.env.JWT_MNEMONIC || "", {
    prefix: "akash",
  });
  const akashWallet = await createSignArbitraryAkashWallet(wallet);
  const txClient = await SigningStargateClient.connectWithSigner(RPC_URL, wallet, {
    registry: new Registry([
      [MsgUnjail.typeUrl, MsgUnjail],
      [`/${MsgCreateDeployment.$type}`, MsgCreateDeployment],
      [`/${MsgCreateLease.$type}`, MsgCreateLease],
      [`/${MsgCreateCertificate.$type}`, MsgCreateCertificate],
      [`/${MsgCloseDeployment.$type}`, MsgCloseDeployment],
      [`/${MsgUpdateDeployment.$type}`, MsgUpdateDeployment],
    ])
  });

  await section('Topping up wallet', async () => {
    console.log(`Using wallet ${akashWallet.address}`);
    await topUpWallet(wallet);
  });

  let authenticate: (options: RequestOptions) => RequestOptions;

  await section('Prepare authentication credentials', async () => {
    if (AUTH_TYPE === 'mtls') {
      console.log('Creating certificates');
      let certificate: CertificatePemDeprecated;
      const cachedCertificatePath = path.resolve(__dirname, `./${akashWallet.address}.json`);
      if (fs.existsSync(cachedCertificatePath)) {
        console.log('Using existing certificate');
        certificate = JSON.parse(fs.readFileSync(cachedCertificatePath, 'utf8'));
      } else {
        certificate = await createCertificate(akashWallet.address);
        fs.writeFileSync(cachedCertificatePath, JSON.stringify(certificate, null, 2));
        await broadcastCertificate(certificate, akashWallet.address, txClient);
        console.log('Certificate created', certificate);
      }

      authenticate = (options) => ({
        ...options,
        cert: certificate.cert,
        key: certificate.privateKey,
        servername: ' ',
        rejectUnauthorized: false,
      });
    } else {
      console.log("Creating JWT to deploy manifest");
      const jwt = new JwtToken(akashWallet);
      const token = await jwt.createToken({
        version: "v1",
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        iss: akashWallet.address,
        leases: {
          access: "full",
        }
      });
      authenticate = (options) => ({
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        servername: new URL(PROVIDER_HOST).hostname
      });
      console.log(token);
    }
  });

  await section(`Getting version of provider API: ${PROVIDER_HOST}/version`, async () => {
    const versionResponse = await request(authenticate({
      hostname: providerUrl.hostname,
      port: providerUrl.port,
      path: '/version',
      method: 'GET',
    }));
    const versionData = JSON.parse(await versionResponse.text()) as { akash: { version: string } };
    console.log(versionData.akash.version);
  });

  const sdl = SDL.fromString(SDL_YAML, "beta3");
  let dseq: string;
  await section('Creating deployment', async () => {
    const latestBlock = await fetch(`${API_URL}/blocks/latest`);
    const latestBlockData: any = await latestBlock.json();
    dseq = latestBlockData.block.header.height;

    console.log(`Latest block: ${dseq}`);

    const deploymentMsg = {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.create({
        deposit: {
          amount: "5000000",
          denom: "uakt",
        },
        id: {
          dseq,
          owner: akashWallet.address,
        },
        depositor: akashWallet.address,
        groups: sdl.groups(),
        version: await sdl.manifestVersion(),
      })
    }

    const deploymentPrice = await txClient.simulate(akashWallet.address, [deploymentMsg], 'test');
    console.log(`Deployment estimated gas price: ${deploymentPrice}`);
    await txClient.signAndBroadcast(akashWallet.address, [deploymentMsg], {
      amount: [
        {
          denom: "uakt",
          amount: '2500000',
        }
      ],
      gas: (1.2 * deploymentPrice).toFixed(0),
    }, "test");

    console.log("Waiting for bids...");
    const bids = await waitForBids(akashWallet.address, dseq);

    const selectedBid = bids.find(bid => bid.bid.bid_id.provider === PROVIDER_WALLET);

    if (!selectedBid) {
      throw new Error(`No bid found from provider ${PROVIDER_WALLET}`);
    }

    console.log(`Selected bid: ${selectedBid.bid.bid_id.provider}`);
    console.log(`Creating lease`);
    const leaseMsg = {
      typeUrl: `/${MsgCreateLease.$type}`,
      value: MsgCreateLease.create({
        bidId: selectedBid.bid.bid_id,
      })
    };

    const leasePrice = await txClient.simulate(akashWallet.address, [leaseMsg], 'test');
    console.log(`Lease estimated gas price: ${leasePrice}`);
    await txClient.signAndBroadcast(akashWallet.address, [leaseMsg], {
      amount: [
        {
          denom: "uakt",
          amount: '2500000',
        }
      ],
      gas: (1.2 * leasePrice).toFixed(0),
    }, "test");
    console.log("Lease created");
  });

  try {
    await updateManifest(providerUrl, authenticate!, sdl, dseq!, akashWallet.address);

    await section('Updating manifest', async () => {
      const newSdl = SDL.fromString(fs.readFileSync(path.resolve(__dirname, "./hello-world-sdl-update.yml"), "utf8"), "beta3");
      const msg = {
        typeUrl: '/akash.deployment.v1beta3.MsgUpdateDeployment',
        value: MsgUpdateDeployment.create({
          id: {
            dseq,
            owner: akashWallet.address,
          },
          version: await newSdl.manifestVersion(),
        })
      };
      const updateManifestPrice = await txClient.simulate(akashWallet.address, [msg], 'test');
      console.log(`Update manifest estimated gas price: ${updateManifestPrice}`);
      const updateManifestTx = await txClient.signAndBroadcast(akashWallet.address, [msg], {
        amount: [
          {
            denom: "uakt",
            amount: '2500000',
          }
        ],
        gas: (1.9 * updateManifestPrice).toFixed(0),
      }, "test");
      console.log(`Update manifest tx: ${updateManifestTx.code}: ${updateManifestTx.rawLog}`);
      await updateManifest(providerUrl, authenticate!, newSdl, dseq!, akashWallet.address);
    })
  } finally {
    if (!SHOULD_KEEP_DEPLOYMENT) {
      await section('Closing deployment', async () => {
        console.log(`waiting ${CLOSE_DEPLOYMENT_DELAY / 1000} seconds`);
        await wait(CLOSE_DEPLOYMENT_DELAY);
        await closeDeployment(dseq, txClient, akashWallet);
        console.log('Deployment closed');
      });
    }
  }
}

async function updateManifest(providerUrl: URL, authenticate: (options: RequestOptions) => RequestOptions, sdl: SDL, dseq: string, walletAddress: string) {
  await section('Deploying manifest', async () => {
    const manifest = JSON.stringify(sdl.manifest(true)).replaceAll('"quantity":{"val', '"size":{"val');
    console.log(`Deploying manifest to "${PROVIDER_HOST}": dseq=${dseq}`);
    console.log('Manifest');
    console.log(manifest);
    console.log('Sending manifest');
    const manifestResponse = await request(authenticate({
      hostname: providerUrl.hostname,
      port: providerUrl.port,
      path: `/deployment/${dseq}/manifest`,
      method: "PUT",
      body: manifest,
    }));

    console.log('manifest sent', manifestResponse.status);
    console.log(await manifestResponse.text());
    console.log('Successfully deployed manifest');
  });

  let lease: any;
  let leaseStatus: any;
  await section('Getting lease details', async () => {
    const leasesResponse = await fetch(`${API_URL}/akash/market/v1beta4/leases/list?filters.owner=${walletAddress}&filters.dseq=${dseq}`);
    const {leases} = await leasesResponse.json() as any;
    lease = leases.find(l => l.lease.lease_id.provider === PROVIDER_WALLET);
    if (!lease) {
      throw new Error(`No lease found on blockchain for provider ${PROVIDER_WALLET}`);
    }

    const leaseStatusResponse = await request(authenticate({
      hostname: providerUrl.hostname,
      port: providerUrl.port,
      path: `/lease/${lease.lease.lease_id.dseq}/${lease.lease.lease_id.gseq}/${lease.lease.lease_id.oseq}/status`,
    }));
    leaseStatus = await leaseStatusResponse.json() as any;
    console.log(`Lease status:`);
    console.dir(leaseStatus, { depth: null });
  });

  console.log('Waiting 5 seconds before getting logs');
  await wait(5000);
  let retry = 5;
  const totalRetries = retry;
  await section('Getting lease logs', async function getLogs() {
    const logs = await readWebsocketEvents(authenticate({
      hostname: providerUrl.hostname,
      port: providerUrl.port,
      path: `/lease/${lease.lease.lease_id.dseq}/${lease.lease.lease_id.gseq}/${lease.lease.lease_id.oseq}/logs?follow=false&tail=10000000`,
    }));
    console.log('Output: ');
    console.log(logs);
    if ((logs === '<No content>' || !logs) && retry-- > 0) {
      console.log(`No content, retrying (${retry}/${totalRetries})...`);
      await getLogs();
    } else if (retry <= 0) {
      console.log('No content, giving up');
    }
  });

  await section('Getting deployment events', async () => {
    const events = await readWebsocketEvents(authenticate({
      hostname: providerUrl.hostname,
      port: providerUrl.port,
      path: `/lease/${lease.lease.lease_id.dseq}/${lease.lease.lease_id.gseq}/${lease.lease.lease_id.oseq}/kubeevents?follow=false&tail=10000000`,
    }));
    console.log('deployment events: ');
    console.log(events);
  });

  await section('Shell access', async () => {
    const shell = await connectToShell(authenticate({
      hostname: providerUrl.hostname,
      port: providerUrl.port,
      path: `/lease/${lease.lease.lease_id.dseq}/${lease.lease.lease_id.gseq}/${lease.lease.lease_id.oseq}/shell?stdin=1&tty=1&podIndex=0&cmd0=${encodeURIComponent("/bin/sh")}&service=${Object.keys(leaseStatus.services)[0]}`,
    }));
    console.log(`ls -l:\n${await shell.type(`ls -l`)}`);
    console.log(`ps -a:\n${await shell.type(`ps -a`)}`);
    shell.close();
  });
}

async function closeDeployment(dseq: string, txClient: SigningStargateClient, akashWallet: SignArbitraryAkashWallet) {
  const closeDeploymentMsg = {
    typeUrl: `/${MsgCloseDeployment.$type}`,
    value: MsgCloseDeployment.create({
      id: {
        dseq,
        owner: akashWallet.address,
      },
    })
  };

  const closeDeploymentPrice = await txClient.simulate(akashWallet.address, [closeDeploymentMsg], 'test');
  console.log(`Close deployment estimated gas price: ${closeDeploymentPrice}`);
  const tx = await txClient.signAndBroadcast(akashWallet.address, [closeDeploymentMsg], {
    amount: [
      {
        denom: "uakt",
        amount: '2500000',
      }
    ],
    gas: (1.5 * closeDeploymentPrice).toFixed(0),
  }, "test");
  console.log(`${tx.code}: ${tx.rawLog}`);
}

async function waitForBids(owner: string, dseq: string, maxAttempts = 10): Promise<any[]> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`https://api.sandbox-01.aksh.pw/akash/market/v1beta4/bids/list?filters.owner=${owner}&filters.dseq=${dseq}`);
      const data: any = await response.json();

      if (data?.bids?.length > 0) {
        return data.bids;
      }
    } catch (error) {
      console.error("Error waiting for bids:", error);
    }

    await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds between attempts
    console.log(`Attempt ${i + 1}/${maxAttempts} failed to get bids. Retrying...`);
  }
  throw new Error("No bids received after maximum attempts");
}

type RequestOptions = https.RequestOptions & { body?: string };
async function request({ body, ...options }: RequestOptions): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = https.request({ method: 'GET', ...options }, async (res) => {
      // console.log(`STATUS: ${res.statusCode}`);
      // res.setEncoding('utf8');
      const response = (await (Array as any).fromAsync(Readable.toWeb(res))).reduce((acc, chunk) => Buffer.concat([acc, chunk]), Buffer.alloc(0));
      resolve(new Response(response.toString('utf-8'), { status: res.statusCode }));
    });
    if (body) {
      req.write(body);
    }
    req.on('error', reject);
    req.end();
  });
}

async function readWebsocketEvents({hostname, port, path, ...options}: RequestOptions) {
  const url = `wss://${hostname}:${port}${path}`;
  console.log('Connecting to websocket', url);
  const ws = new WebSocket(url, {
    ...options,
  });
  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log(`WebSocket to ${url} opened`);
    });
    ws.on('error', reject);

    let lastMessageTimestamp = Date.now();
    let logFileContent = '';
    const waitTimeout = 10_000;
    const timerId = setInterval(() => {
      const elapsed = Date.now() - lastMessageTimestamp;

      if (elapsed > waitTimeout) {
        console.log(`Waiting for messages from ${url} more than ${waitTimeout / 1000} seconds but there are none, closing websocket`);
        clearInterval(timerId);
        ws.terminate();
        resolve('<No content>')
      }
    }, 1_000);
    ws.on('message', (event) => {
      // console.log('received message', event.toString('utf-8'));
      const parsedLog = JSON.parse(event.toString('utf-8'));
      if (parsedLog.closed) {
        return;
      }

      let service: string;
      let message: string;
      if (path?.includes('/logs')) {
        service = parsedLog?.name ? parsedLog?.name.split("-")[0] : "";
        message = `[${service}]: ${parsedLog.message}`;
      } else {
        service = parsedLog.object?.name ? parsedLog.object?.name.split("-")[0] : "";
        message = `[${service}]: [${parsedLog.type}] [${parsedLog.reason}] [${parsedLog.object?.kind}] ${parsedLog.note}`;
      }

      logFileContent += message + "\n";
      lastMessageTimestamp = Date.now();
    });

    ws.on('close', (code, buffer) => {
      console.log(`WebSocket to ${url} was closed with "${code}" and response: `, buffer);
      clearInterval(timerId);
      resolve(logFileContent);
    });
  });
}

function section(title: string, fn: () => Promise<any>) {
  console.log(`\n\n\x1b[1m${title}\x1b[0m`);
  return fn();
}

async function topUpWallet(wallet: DirectSecp256k1HdWallet) {
  try {
    const accounts = await wallet.getAccounts();
    const balance = await getWalletBalance(accounts[0].address);

    if (balance > 100 * 1_000_000) {
      // 100 AKT should be enough
      console.log('skipping top up, balance is enough');
      return;
    }

    const faucetUrl = 'https://faucet.sandbox-01.aksh.pw/faucet';
    const response = await fetch(faucetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `address=${encodeURIComponent(accounts[0].address)}`
    });
    if (response.status >= 300) {
      console.error(`Unexpected faucet response status: ${response.status}`);
      console.error("Faucet response:", await response.text());
    } else {
      console.log('Topped up wallet');
    }
  } catch (error) {
    console.error("Unable to top up wallet");
    console.error(error);
  }
}

async function getWalletBalance(address: string) {
  const response = await fetch(`${API_URL}/cosmos/bank/v1beta1/balances/${address}`);
  const data = await response.json();
  return data.balances.find((balance: Record<string, string>) => balance.denom === "uakt")?.amount || 0;
}

async function connectToShell({ hostname, port, path, ...options}: RequestOptions) {
  return new Promise<{ close: () => void, type: (command: string) => Promise<string> }>((resolve, reject) => {
    const url = `wss://${hostname}:${port}${path}`;
    console.log('Connecting to websocket', url);

    const ws = new WebSocket(url, {
      ...options,
    });
    const cprRegex = /(\x1b\[(\d+);(\d+)R|\x1b\[6n)$/g;

    ws.on('open', () => {
      console.log(`WebSocket to ${url} opened`);
    });
    const dsrRequestRegex = /\x1b\[6n/g;
    ws.once('message', (event) => {
      if (dsrRequestRegex.test(event.toString('utf-8'))) {
        const reply = Buffer.from('\x1b[1;1R', 'utf-8');
        ws.send(Buffer.concat([Buffer.from([0x68]), reply]));
        resolve({
          close: () => ws.terminate(),
          type: async (command: string) => {
            return new Promise((resolve) => {
              const buffer = Buffer.concat([Buffer.of(104), Buffer.from(command, 'utf-8'), Buffer.of(13)]);
              ws.send(buffer);
              // console.log(`send ${command}`, buffer.toString('utf-8'));
              const timerId = setTimeout(() => {
                resolve('<timedout>');
              }, 20_000);
              let response = '';
              ws.on('message', function processResponse(event: Buffer) {
                const header = event[0];
                const payload = event.slice(1).toString('utf-8');
                const isLast = cprRegex.test(payload);

                if (header === 100) {
                  response += isLast ? payload.replace(cprRegex, '') : payload;
                }

                if (cprRegex.test(payload)) {
                  // console.log(`resolved ${command}`)
                  clearTimeout(timerId);
                  ws.off('message', processResponse);
                  resolve(response);
                }
              });
            });
          }
        });
      }
    });
    ws.on('error', reject);
    ws.on('close', () => {
      console.log(`WebSocket to ${url} was closed`);
    });
  });
}

main();
