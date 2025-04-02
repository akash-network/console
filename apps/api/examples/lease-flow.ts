/**
 * This script demonstrates how to create a deployment with a lease using the API and an API key.
 *
 * The script follows these steps:
 * 1. Creates a certificate for secure communication
 * 2. Creates a deployment using the provided SDL file
 * 3. Waits for and collects bids from providers
 * 4. Creates a lease using the first received bid
 * 5. Deposits into the deployment
 * 6. Updates the deployment
 * 7. Closes the deployment when finished
 *
 * Requirements:
 * - API_KEY environment variable must be set
 * - .env.local file in the script directory (optional)
 * - SDL file at ../test/mocks/hello-world-sdl.yml
 *
 * How to run (at the root of the project):
 * - npm run examples:lease-flow -w @akashnetwork/console-api
 */

import { config } from "@dotenvx/dotenvx";
import axios from "axios";
import * as fs from "node:fs";
import * as path from "node:path";

// Load environment variables from .env.local in the script directory
const envPath = path.resolve(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.warn(".env.local file not found in script directory, using existing environment variables");
}

// Load the SDL file
const yml = fs.readFileSync(path.resolve(__dirname, "./hello-world-sdl.yml"), "utf8");

// Configure axios
const API_URL = process.env.API_URL || "http://localhost:3080";
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

async function waitForBids(dseq: string, apiKey: string, maxAttempts = 10): Promise<any[]> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await api.get(`/v1/bids?dseq=${dseq}`, {
        headers: {
          "x-api-key": apiKey
        }
      });

      if (response.data?.data?.length > 0) {
        return response.data.data;
      }
    } catch (error) {
      console.error("Error waiting for bids:", error);
    }

    await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds between attempts
    console.log(`Attempt ${i + 1}/${maxAttempts} failed to get bids. Retrying...`);
  }
  throw new Error("No bids received after maximum attempts");
}

/**
 * This script is used to create a lease for a deployment using an api key.
 * It creates a certificate, creates a deployment, waits for bids, creates a lease, and then closes the deployment.
 */
async function main() {
  try {
    // 1. Setup user and get authentication
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable is required");
    }

    // 2. Create certificate
    console.log("Creating certificate...");
    const certResponse = await api.post(
      "/v1/certificates",
      {},
      {
        headers: {
          "x-api-key": apiKey
        }
      }
    );

    const { certPem, encryptedKey } = certResponse.data.data;
    console.log("Certificate created successfully");

    // 3. Create deployment
    console.log("Creating deployment...");
    const deployResponse = await api.post(
      "/v1/deployments",
      {
        data: {
          sdl: yml,
          deposit: 5
        }
      },
      {
        headers: {
          "x-api-key": apiKey
        }
      }
    );

    const { dseq, manifest } = deployResponse.data.data;
    console.log(`Deployment created with dseq: ${dseq}`);

    // 4. Wait for and get bids
    console.log("Waiting for bids...");
    const bids = await waitForBids(dseq, apiKey);
    console.log(`Received ${bids.length} bids`);

    // Select a bid from a specific provider
    const targetProvider = "akash175llqyjvxfle9qwt740vm46772dzaznpzgm576";
    const selectedBid = bids.find(bid => bid.bid.bid_id.provider === targetProvider);

    if (!selectedBid) {
      throw new Error(`No bid found from provider ${targetProvider}`);
    }

    const body = {
      manifest,
      certificate: {
        certPem,
        keyPem: encryptedKey
      },
      leases: [
        {
          dseq,
          gseq: selectedBid.bid.bid_id.gseq,
          oseq: selectedBid.bid.bid_id.oseq,
          provider: selectedBid.bid.bid_id.provider
        }
      ]
    };

    // 5. Create lease and send manifest
    console.log("Creating lease and sending manifest...");
    const leaseResponse = await api.post("/v1/leases", body, {
      headers: {
        "x-api-key": apiKey
      }
    });

    if (leaseResponse.status !== 200) {
      throw new Error(`Failed to create lease: ${leaseResponse.statusText}`);
    }
    console.log("Lease created successfully");

    // 6. Deposit into deployment
    console.log("Depositing into deployment...");
    const depositResponse = await api.post(
      `/v1/deposit-deployment`,
      {
        data: {
          dseq,
          deposit: 0.5
        }
      },
      {
        headers: {
          "x-api-key": apiKey
        }
      }
    );
    console.log("Deposit successful: ", depositResponse.data.data.escrow_account);

    // Load the updated SDL file
    const updatedYml = fs.readFileSync(path.resolve(__dirname, "./hello-world-sdl-update.yml"), "utf8");

    // Update deployment
    console.log("Updating deployment...");
    const updateResponse = await api.put(
      `/v1/deployments/${dseq}`,
      {
        data: {
          sdl: updatedYml,
          certificate: {
            certPem,
            keyPem: encryptedKey
          }
        }
      },
      {
        headers: {
          "x-api-key": apiKey
        }
      }
    );

    if (updateResponse.status !== 200) {
      throw new Error(`Failed to update deployment: ${updateResponse.statusText}`);
    }
    console.log("Deployment updated successfully");

    // 7. Close deployment
    console.log("Closing deployment...");
    const closeResponse = await api.delete(`/v1/deployments/${dseq}`, {
      headers: {
        "x-api-key": apiKey
      }
    });

    if (closeResponse.status !== 200) {
      throw new Error(`Failed to close deployment: ${closeResponse.statusText}`);
    }

    console.log("Deployment closed successfully");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Error:", {
        message: error.message,
        response: error.response?.data
      });
    } else {
      console.error("Error:", error);
    }
    process.exit(1);
  }
}

main();
