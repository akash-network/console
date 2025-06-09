import { MsgCloseDeployment } from "@akashnetwork/akash-api/v1beta3";
import { netConfig } from "@akashnetwork/net";
import { DirectSecp256k1HdWallet, Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";

const mnemonic = process.env.TEST_WALLET_MNEMONIC;

async function main() {
  if (!mnemonic) {
    throw new Error("TEST_WALLET_MNEMONIC is not provided");
  }

  const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: "akash"
  });

  const account = (await signer.getAccounts())[0];
  console.log("Fetching deployments...");
  const deploymentsResponse = await fetch(
    `${netConfig.getBaseAPIUrl("sandbox")}/akash/deployment/v1beta3/deployments/list?filters.owner=${account.address}&filters.state=active&pagination.limit=100`
  );
  const { deployments } = await deploymentsResponse.json();

  if (deployments.length === 0) {
    console.log("No active deployments found. Exiting...");
    return;
  }

  console.log(`Found ${deployments.length} active deployments. Going to close them...`);

  const closeDeploymentsMessages = deployments.map((deployment: any) => {
    return {
      typeUrl: `/${MsgCloseDeployment.$type}`,
      value: MsgCloseDeployment.fromPartial({
        id: deployment.deployment.deployment_id
      })
    };
  });

  const txClient = await SigningStargateClient.connectWithSigner(netConfig.getBaseRpcUrl("sandbox"), signer, {
    registry: new Registry([[`/${MsgCloseDeployment.$type}`, MsgCloseDeployment]])
  });

  console.log("Closing deployments...");
  const gas = await txClient.simulate(account.address, closeDeploymentsMessages, "close deployments via script");
  const tx = await txClient.signAndBroadcast(account.address, closeDeploymentsMessages, {
    amount: [{ amount: "2500", denom: "uakt" }],
    gas: Math.floor(1.2 * gas).toString()
  });

  if (tx.code !== 0) {
    console.error(`Transaction failed with code ${tx.code}: ${tx.rawLog}`);
  } else {
    console.log(`Transaction hash: ${tx.transactionHash}`);
  }

  txClient.disconnect();
}

main().catch(console.error);
