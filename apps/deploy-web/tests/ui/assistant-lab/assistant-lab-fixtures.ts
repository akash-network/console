import type { Page } from "@playwright/test";

import type { LabFixture } from "./assistant-scenario.types";

const FIXTURE_RUNTIME_LIMIT_HOURS = 3;
const BID_WAIT_MS = 120_000;
const BID_POLL_MS = 5_000;

interface ServiceSpec {
  image: string;
  port: number;
  memory: string;
  command?: string;
}

function sdlOf({ image, port, memory, command }: ServiceSpec, gpu = ""): string {
  const commandBlock = command ? `\n    command:\n      - sh\n      - -c\n    args:\n      - ${JSON.stringify(command)}` : "";

  return `version: "2.0"
services:
  web:
    image: ${image}${commandBlock}
    expose:
      - port: ${port}
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.2
        memory:
          size: ${memory}
        storage:
          - size: 512Mi${gpu}
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;
}

const NO_PROVIDER_HAS_THIS_GPU = `
        gpu:
          units: 8
          attributes:
            vendor:
              nvidia:
                - model: h200`;

const FIXTURE_SDLS: Record<LabFixture, { sdl: string; lease: boolean }> = {
  live_web: { sdl: sdlOf({ image: "nginx:1.25.3", port: 80, memory: "256Mi" }), lease: true },
  crash_loop: {
    sdl: sdlOf({
      image: "busybox:1.36",
      port: 8080,
      memory: "128Mi",
      command: "echo starting api; echo 'Error: missing required environment variable DATABASE_URL'; sleep 5; exit 1"
    }),
    lease: true
  },
  oom: {
    sdl: sdlOf({
      image: "python:3.12-alpine",
      port: 8080,
      memory: "128Mi",
      command: 'echo loading cache; python -c "b = bytearray(600*1024*1024); print(len(b))"'
    }),
    lease: true
  },
  bad_image: { sdl: sdlOf({ image: "nginx:1.99.99-doesnotexist", port: 80, memory: "256Mi" }), lease: true },
  private_image: { sdl: sdlOf({ image: "ghcr.io/akash-network/console-assistant-lab-private:1.0.0", port: 80, memory: "256Mi" }), lease: true },
  wrong_port: { sdl: sdlOf({ image: "nginx:1.25.3", port: 3000, memory: "256Mi" }), lease: true },
  no_bids: { sdl: sdlOf({ image: "vllm/vllm-openai:v0.6.3", port: 8000, memory: "4Gi" }, NO_PROVIDER_HAS_THIS_GPU), lease: false },
  closed: { sdl: sdlOf({ image: "nginx:1.25.3", port: 80, memory: "256Mi" }), lease: true }
};

export interface FixtureDeployment {
  fixture: LabFixture;
  dseq: string | null;
  leased: boolean;
  error?: string;
}

type Json = Record<string, any>;

async function api(page: Page, baseUrl: string, method: "GET" | "POST" | "DELETE", path: string, data?: unknown): Promise<Json> {
  const response = await page.request.fetch(`${baseUrl}/api/proxy${path}`, { method, data, timeout: 120_000 });
  const text = await response.text();
  if (!response.ok()) throw new Error(`${method} ${path} -> ${response.status()} ${text.slice(0, 300)}`);

  return text ? JSON.parse(text) : {};
}

async function firstOpenBid(page: Page, baseUrl: string, dseq: string): Promise<Json | null> {
  const deadline = Date.now() + BID_WAIT_MS;

  while (Date.now() < deadline) {
    const { data } = await api(page, baseUrl, "GET", `/v1/bids?dseq=${dseq}`);
    const open = (data as Json[]).find(entry => entry.bid?.state === "open");
    if (open) return open.bid;
    await page.waitForTimeout(BID_POLL_MS);
  }

  return null;
}

export async function createFixtureDeployment(page: Page, baseUrl: string, fixture: LabFixture): Promise<FixtureDeployment> {
  const { sdl, lease } = FIXTURE_SDLS[fixture];

  try {
    const created = await api(page, baseUrl, "POST", "/v1/deployments", {
      data: { sdl, name: `lab-${fixture.replaceAll("_", "-")}`, runtimeLimitHours: FIXTURE_RUNTIME_LIMIT_HOURS }
    });
    const dseq = String(created.data.dseq);
    if (!lease) return { fixture, dseq, leased: false };

    const bid = await firstOpenBid(page, baseUrl, dseq);
    if (!bid) return { fixture, dseq, leased: false, error: "no bid within the wait" };

    await api(page, baseUrl, "POST", "/v1/leases", {
      leases: [{ dseq, gseq: bid.id.gseq, oseq: bid.id.oseq, provider: bid.id.provider }]
    });
    if (fixture === "closed") await closeDeployment(page, baseUrl, dseq);

    return { fixture, dseq, leased: true };
  } catch (error) {
    return { fixture, dseq: null, leased: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function closeDeployment(page: Page, baseUrl: string, dseq: string): Promise<void> {
  await api(page, baseUrl, "DELETE", `/v1/deployments/${dseq}`);
}

export async function isUsableFixture(page: Page, baseUrl: string, fixture: LabFixture, dseq: string): Promise<boolean> {
  const { data } = await api(page, baseUrl, "GET", `/v1/deployments/${dseq}`);
  const leases = (data?.leases ?? []) as Json[];
  const hasActiveLease = leases.some(lease => lease.state === "active");

  return data?.deployment?.state === "active" && (FIXTURE_SDLS[fixture].lease ? hasActiveLease : true);
}

export async function listActiveDseqs(page: Page, baseUrl: string): Promise<string[]> {
  const { data } = await api(page, baseUrl, "GET", "/v1/deployments?skip=0&limit=100");
  return ((data?.deployments ?? []) as Json[]).map(entry => String(entry.deployment?.id?.dseq)).filter(Boolean);
}
