import { netConfig, SupportedChainNetworks } from "@akashnetwork/net";

import { CertificateValidator, createCertificateValidatorInstrumentation } from "./services/CertificateValidator";
import { ProviderProxy } from "./services/ProviderProxy";
import { ProviderService } from "./services/ProviderService";
import { WebsocketStats } from "./services/WebsocketStats";

const wsStats = new WebsocketStats();
const providerService = new ProviderService((network: SupportedChainNetworks) => {
  // TEST_CHAIN_NETWORK_URL is hack for functional tests
  // there is no good way to mock external server in nodejs
  // both nock and msw do not work well when I need to use low level API like X509 certificate validation
  // for some reason when those libraries are used I receive MockSocket instead of TLSSocket
  // @see https://github.com/mswjs/msw/discussions/2416
  return process.env.TEST_CHAIN_NETWORK_URL || netConfig.getBaseAPIUrl(network);
}, fetch);
const certificateValidator = new CertificateValidator(
  Date.now,
  providerService,
  process.env.NODE_ENV === "test" ? undefined : createCertificateValidatorInstrumentation(console)
);
const providerProxy = new ProviderProxy(certificateValidator);

export const container = {
  wsStats,
  providerProxy,
  certificateValidator
};
