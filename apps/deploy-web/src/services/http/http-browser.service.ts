import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { ApiUrlService } from "@src/services/api-url/api-url.service";
import { createAppRootContainer } from "@src/services/app-di-container/app-di-container";
import { createChildContainer } from "../container/createContainer";
import { BitbucketService } from "../remote-deploy/bitbucket-http.service";
import { GitHubService } from "../remote-deploy/github-http.service";
import { GitLabService } from "../remote-deploy/gitlab-http.service";
import { UserProviderService } from "../user-provider/user-provider.service";

const rootContainer = createAppRootContainer({
  runtimeEnv: "browser",
  BASE_API_MAINNET_URL: browserEnvConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL,
  BASE_PROVIDER_PROXY_URL: browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL,
  MANAGED_WALLET_NETWORK_ID: browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
  apiUrlService: () => new ApiUrlService(browserEnvConfig)
});

export const services = createChildContainer(rootContainer, {
  userProviderService: () => new UserProviderService(),
  notificationsApi: () =>
    createAPIClient({
      requestFn,
      baseUrl: "/api/proxy",
      queryClient: services.queryClient
    }),
  githubService: () => new GitHubService(),
  bitbucketService: () => new BitbucketService(),
  gitlabService: () => new GitLabService()
});
