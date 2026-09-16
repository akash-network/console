import "reflect-metadata";
import "@akashnetwork/env-loader";
import "@src/app";

import { createOtelLogger } from "@akashnetwork/logging/otel";
import { Command } from "commander";
import { decodeProtectedHeader } from "jose";
import { randomBytes } from "node:crypto";
import { container } from "tsyringe";
import { z } from "zod";

import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { DeploymentStoredSecretsOfUser } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsDerivationService } from "@src/deployment/services/sdl-secrets-derivation/sdl-secrets-derivation.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { parseSdlForStorage, sdlForStorage } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import type { DataKeyOutput } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";

/** Every row this script records carries this name, and `cleanup` deletes only rows carrying it. */
const REHEARSAL_DEPLOYMENT_NAME = "rekey-rehearsal";
const DEFAULT_DEPLOYMENT_COUNT = 3;
const DEFAULT_SECRETS_PER_DEPLOYMENT = 2;
const INSPECT_BATCH_SIZE = 100;

interface UserSelection {
  userId?: string;
  email?: string;
}

interface WriteTarget {
  confirmDatabase: string;
}

interface SeedOptions extends UserSelection, WriteTarget {
  count: number;
  secrets: number;
}

interface DatabaseTarget {
  host: string;
  name: string;
}

interface InspectedDeployment {
  dseq: string;
  kid: unknown;
  opens: boolean;
  secretCount?: number;
  error?: string;
}

const logger = createOtelLogger({ context: "REHEARSE_DEPLOYMENT_SECRETS" });
const program = new Command();

program
  .name("rehearse-deployment-secrets")
  .description(
    "Gives one user stored deployment secrets to rehearse rekey-user-data-key against, on an environment that is not the one real users deploy from"
  );

function withUserSelection(command: Command): Command {
  return command
    .option("-u, --user-id <uuid>", "The user, by id", value => z.string().uuid().parse(value))
    .option("-e, --email <email>", "The user, by the email on their account", value => z.string().email().parse(value));
}

function withDatabaseConfirmation(command: Command): Command {
  return command.requiredOption(
    "--confirm-database <name>",
    "The database this environment's connection string must name, which a write refuses to run without"
  );
}

const positiveInteger = (value: string) => z.coerce.number().int().positive().parse(value);

withDatabaseConfirmation(withUserSelection(program.command("seed")))
  .description("Records closed deployments carrying sealed secrets for the user, stored the way a create stores them, so a re-key has rows to walk")
  .option("-c, --count <number>", "How many deployments to record", positiveInteger, DEFAULT_DEPLOYMENT_COUNT)
  .option("-s, --secrets <number>", "How many secrets each deployment carries", positiveInteger, DEFAULT_SECRETS_PER_DEPLOYMENT)
  .action(async (options: SeedOptions) => {
    await runCommand("seed", () => seed(options));
  });

withUserSelection(program.command("inspect"))
  .description("Lists the user's data keys and, for every deployment of theirs holding a secret, which key seals it and whether it opens")
  .action(async (options: UserSelection) => {
    await runCommand("inspect", () => inspect(options));
  });

withDatabaseConfirmation(withUserSelection(program.command("cleanup")))
  .description("Deletes the deployments this script recorded for the user, and nothing else")
  .action(async (options: UserSelection & WriteTarget) => {
    await runCommand("cleanup", () => cleanup(options));
  });

async function seed(options: SeedOptions): Promise<void> {
  assertDatabaseIsConfirmed(options.confirmDatabase);
  const user = await resolveUser(options);
  await container.resolve(SdlSecretsSealingKeyService).getSealingKey();

  const derivationService = container.resolve(SdlSecretsDerivationService);
  const sdlSecretsService = container.resolve(SdlSecretsService);
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
  const firstDseq = Date.now();
  const recorded: string[] = [];

  for (let index = 0; index < options.count; index++) {
    const dseq = String(firstDseq + index);
    const parsed = parseSdlForStorage(rehearsalSdl(options.secrets));

    if (parsed.document === null) throw new Error("The rehearsal SDL did not parse");

    const secrets = derivationService.derive(parsed.document, { includeEnvValues: true });
    const { sdl } = sdlForStorage(parsed, SDL_MAX_LENGTH);

    if (sdl === null) throw new Error("The rehearsal SDL is too large to store");

    const sealedSecrets = await sdlSecretsService.sealForStorage({ userId: user.id, dseq, secrets });

    await deploymentSettingRepository.create({
      userId: user.id,
      dseq,
      sdl,
      sealedSecrets,
      name: REHEARSAL_DEPLOYMENT_NAME,
      autoTopUpEnabled: false,
      closed: true
    });

    recorded.push(dseq);
    logger.info({ event: "REHEARSAL_DEPLOYMENT_RECORDED", userId: user.id, dseq, secretCount: Object.keys(secrets).length });
  }

  logger.info({ event: "REHEARSAL_SEED_END", userId: user.id, deployments: recorded, secretsPerDeployment: options.secrets });
}

async function inspect(options: UserSelection): Promise<void> {
  const user = await resolveUser(options);
  const dataKeyRepository = container.resolve(DataKeyRepository);
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
  const [active, retired] = await Promise.all([dataKeyRepository.findByUserId(user.id), dataKeyRepository.findRetiredByUserId(user.id)]);
  const deployments: InspectedDeployment[] = [];

  for await (const batch of deploymentSettingRepository.findStoredSecretsByUserIteratively({ userId: user.id, batchSize: INSPECT_BATCH_SIZE })) {
    for (const row of batch) {
      deployments.push(await inspectDeployment(user.id, row));
    }
  }

  logger.info({
    event: "REHEARSAL_INSPECT_REPORT",
    userId: user.id,
    activeDataKey: active ? describeDataKey(active) : null,
    retiredDataKeys: retired.map(describeDataKey),
    deploymentsByKid: countByKid(deployments),
    deployments
  });
}

async function cleanup(options: UserSelection & WriteTarget): Promise<void> {
  assertDatabaseIsConfirmed(options.confirmDatabase);
  const user = await resolveUser(options);
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
  const recordedByThisScript = { userId: user.id, name: REHEARSAL_DEPLOYMENT_NAME };
  const deploymentsDeleted = await deploymentSettingRepository.count(recordedByThisScript);

  await deploymentSettingRepository.deleteBy(recordedByThisScript);

  logger.info({ event: "REHEARSAL_CLEANUP_END", userId: user.id, deploymentsDeleted });
}

/** `DEPLOYMENT_ENV` and `NETWORK` are set by the chart at deploy time, not by Doppler, so a local run cannot read which console it reached and the operator names the database instead. */
function assertDatabaseIsConfirmed(confirmed: string): void {
  const target = databaseOf(container.resolve(CoreConfigService).get("POSTGRES_DB_URI"));

  if (target?.name === confirmed) return;

  throw new Error(`Refusing to write: --confirm-database says "${confirmed}" and the connection string names "${target?.name ?? "nothing readable"}"`);
}

/** Says which console and which database the command reached, so an operator sees where they are before reading anything below. */
function logTarget(name: string): void {
  const config = container.resolve(CoreConfigService);
  const target = databaseOf(config.get("POSTGRES_DB_URI"));

  logger.info({
    event: "REHEARSAL_TARGET",
    name,
    deploymentEnv: config.get("DEPLOYMENT_ENV"),
    network: config.get("NETWORK"),
    database: target?.name,
    databaseHost: target?.host
  });
}

/** Host and database name only: the connection string also carries the password. */
function databaseOf(uri: string): DatabaseTarget | undefined {
  try {
    const { hostname, port, pathname } = new URL(uri);

    return { host: port ? `${hostname}:${port}` : hostname, name: pathname.slice(1) };
  } catch {
    return undefined;
  }
}

async function resolveUser({ userId, email }: UserSelection): Promise<UserOutput> {
  if ((userId === undefined) === (email === undefined)) throw new Error("Pass exactly one of --user-id or --email");

  const userRepository = container.resolve(UserRepository);
  const user = userId === undefined ? await userRepository.findOneBy({ email }) : await userRepository.findById(userId);

  if (!user) throw new Error(`No user matches ${userId ?? email}`);

  logger.info({ event: "REHEARSAL_USER_RESOLVED", userId: user.id, username: user.username });

  return user;
}

async function inspectDeployment(userId: string, row: DeploymentStoredSecretsOfUser): Promise<InspectedDeployment> {
  const kid = kidOf(row.sealedSecrets);

  try {
    const secrets = await container.resolve(SdlSecretsService).openStored({ userId, dseq: row.dseq, sealedSecrets: row.sealedSecrets });

    return { dseq: row.dseq, kid, opens: true, secretCount: Object.keys(secrets).length };
  } catch (error) {
    return { dseq: row.dseq, kid, opens: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function kidOf(sealedSecrets: string): unknown {
  try {
    return decodeProtectedHeader(sealedSecrets).kid;
  } catch {
    return undefined;
  }
}

function describeDataKey({ id, wrappedByKid, createdAt, retiredAt }: DataKeyOutput) {
  return { id, wrappedByKid, createdAt, retiredAt };
}

function countByKid(deployments: InspectedDeployment[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const { kid } of deployments) {
    const key = typeof kid === "string" ? kid : "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

/** Values in the clear, because this is the document a client submits: the derivation takes them out and the stored SDL references them by name. */
function rehearsalSdl(secretCount: number): string {
  const env = Array.from({ length: secretCount }, (_, index) => `      - REHEARSAL_SECRET_${index + 1}=${randomBytes(16).toString("hex")}`).join("\n");

  return `version: "2.0"
services:
  web:
    image: nginx:1.27
    env:
${env}
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 512Mi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;
}

async function runCommand(name: string, handler: () => Promise<void>): Promise<void> {
  logger.info({ event: "REHEARSAL_COMMAND_START", name });
  logTarget(name);

  try {
    await container.resolve(ExecutionContextService).runWithContext(handler);
    logger.info({ event: "REHEARSAL_COMMAND_END", name });
  } catch (error) {
    logger.error({ event: "REHEARSAL_COMMAND_FAILED", name, error });
    process.exitCode = 1;
  } finally {
    await container.dispose();
  }
}

program.parseAsync();
