import type {
  ChainRecord,
  EndpointOptions,
  LogLevel,
  MainWalletBase,
  NameServiceName,
  SessionOptions,
  SignerOptions,
  WalletConnectOptions
} from "@cosmos-kit/core";
import { Logger, WalletManager } from "@cosmos-kit/core";

export interface WalletManagerOptions {
  wallets: MainWalletBase[];
  chains: Array<ChainRecord["name"] | Exclude<ChainRecord["chain"], undefined>>;
  assetList?: Exclude<ChainRecord["assetList"], undefined>[];
  logLevel?: LogLevel;
  throwErrors?: boolean;
  subscribeConnectEvents?: boolean;
  allowedCosmiframeParentOrigins?: string[];
  defaultNameService?: NameServiceName;
  walletConnectOptions?: WalletConnectOptions;
  signerOptions?: SignerOptions;
  endpointOptions?: EndpointOptions;
  sessionOptions?: SessionOptions;
}

export function createWalletManager(options: WalletManagerOptions): WalletManager {
  const logger = new Logger(options.logLevel ?? "WARN");

  return new WalletManager(
    options.chains,
    options.wallets,
    logger,
    options.throwErrors ?? false,
    options.subscribeConnectEvents ?? true,
    options.allowedCosmiframeParentOrigins ?? [
      "http://localhost:*",
      "https://localhost:*",
      "https://app.osmosis.zone",
      "https://daodao.zone",
      "https://dao.daodao.zone",
      "https://my.abstract.money",
      "https://apps.abstract.money",
      "https://console.abstract.money"
    ],
    options.assetList,
    options.defaultNameService ?? "icns",
    options.walletConnectOptions,
    options.signerOptions,
    options.endpointOptions,
    options.sessionOptions
  );
}
