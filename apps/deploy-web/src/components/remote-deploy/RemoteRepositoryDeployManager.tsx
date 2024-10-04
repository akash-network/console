import { Dispatch, useEffect, useState } from "react";
import { Control, UseFormSetValue } from "react-hook-form";
import { Button, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { Bitbucket, Github as GitIcon, GitlabFull } from "iconoir-react";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";

import { CI_CD_TEMPLATE_ID, CURRENT_SERVICE, DEFAULT_ENV_IN_YML, protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import { useWhen } from "@src/hooks/useWhen";
import { useFetchAccessToken, useUserProfile } from "@src/queries/useGithubQuery";
import { useGitLabFetchAccessToken, useGitLabUserProfile } from "@src/queries/useGitlabQuery";
import { BitbucketService } from "@src/services/remote-deploy/bitbucket-http.service";
import { GitHubService } from "@src/services/remote-deploy/github-http.service";
import { GitLabService } from "@src/services/remote-deploy/gitlab-http.service";
import { EnvVarUpdater } from "@src/services/remote-deploy/remote-deployment-controller.service";
import { tokens } from "@src/store/remoteDeployStore";
import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { UrlService } from "@src/utils/urlUtils";
import { useBitFetchAccessToken, useBitUserProfile } from "../../queries/useBitBucketQuery";
import BitBucketManager from "./bitbucket/BitBucketManager";
import RemoteBuildInstallConfig from "./deployment-configurations/RemoteBuildInstallConfig";
import RemoteDeployEnvDropdown from "./deployment-configurations/RemoteDeployEnvDropdown";
import GithubManager from "./github/GithubManager";
import GitlabManager from "./gitlab/GitlabManager";
import AccountDropDown from "./AccountDropdown";
import CustomInput from "./BoxTextInput";
const RemoteRepositoryDeployManager = ({
  setValue,
  services,
  control,
  deploymentName,
  setDeploymentName,
  setIsRepoInputValid
}: {
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  services: ServiceType[];
  control: Control<SdlBuilderFormValuesType>;
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  setIsRepoInputValid?: Dispatch<boolean>;
}) => {
  const [token, setToken] = useAtom(tokens);

  const [selectedTab, setSelectedTab] = useState("git");
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const isRepoAndBranchPresent = (env: Array<{ key: string }>) =>
    env.some(e => e.key === protectedEnvironmentVariables.REPO_URL) && env.some(e => e.key === protectedEnvironmentVariables.BRANCH_NAME);

  const isValid = isRepoAndBranchPresent(services?.[0]?.env || []);
  const isRepoUrlDefault = (env: ServiceType["env"]) => env?.some(e => e.key === protectedEnvironmentVariables.REPO_URL && e.value === DEFAULT_ENV_IN_YML);

  const shouldResetValue = isRepoUrlDefault(services?.[0]?.env || []);

  const envVarUpdater = new EnvVarUpdater(services);

  const { reLoginWithGithub, loginWithGithub } = new GitHubService();

  const { data: userProfile, isLoading: fetchingProfile } = useUserProfile();
  const { mutate: fetchAccessToken, isLoading: fetchingToken } = useFetchAccessToken(navigateToNewDeployment);

  const { loginWithBitBucket } = new BitbucketService();
  const { data: userProfileBit, isLoading: fetchingProfileBit } = useBitUserProfile();
  const { mutate: fetchAccessTokenBit, isLoading: fetchingTokenBit } = useBitFetchAccessToken(navigateToNewDeployment);

  const { handleGitLabLogin } = new GitLabService();
  const { data: userProfileGitLab, isLoading: fetchingProfileGitLab } = useGitLabUserProfile();
  const { mutate: fetchAccessTokenGitLab, isLoading: fetchingTokenGitLab } = useGitLabFetchAccessToken(navigateToNewDeployment);

  useWhen(isValid, () => {
    setIsRepoInputValid?.(true);
  });

  useWhen(!isValid, () => {
    setIsRepoInputValid?.(false);
  });

  useWhen(shouldResetValue, () => {
    setValue(CURRENT_SERVICE, []);
  });

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);

    const code = url.searchParams.get("code");

    if (code && !token?.accessToken && hydrated) {
      if (token?.type === "github") fetchAccessToken(code);
      if (token?.type === "bitbucket") fetchAccessTokenBit(code);
      if (token?.type === "gitlab") fetchAccessTokenGitLab(code);
    }
  }, [hydrated]);

  function navigateToNewDeployment() {
    router.replace(
      UrlService.newDeployment({
        step: RouteStep.editDeployment,
        gitProvider: "github",
        templateId: CI_CD_TEMPLATE_ID
      })
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-col rounded border bg-card px-4 py-6 text-card-foreground md:px-6">
        <div className="flex items-center justify-between gap-6">
          <h2 className="font-semibold">Import Repository</h2>

          {token?.accessToken && (
            <div className="md:hidden">
              <AccountDropDown userProfile={userProfile} userProfileBit={userProfileBit} userProfileGitLab={userProfileGitLab} />
            </div>
          )}
        </div>

        {
          <Tabs
            onValueChange={value => {
              setSelectedTab(value);
              setValue(CURRENT_SERVICE, []);
            }}
            defaultValue="git"
            className="mt-6"
          >
            <div className="mb-6 flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="md:gap-auto flex h-auto w-full flex-col items-center gap-1 p-2 md:w-auto md:flex-row md:gap-0 md:px-1 md:py-1">
                <TabsTrigger value="git" className="w-full py-2.5 md:w-auto md:py-1.5">
                  Git Provider
                </TabsTrigger>
                <TabsTrigger value="public" className="w-full py-2.5 md:w-auto md:py-1.5">
                  Third-Party Git Repository
                </TabsTrigger>
              </TabsList>
              {token?.accessToken && (
                <div className="hidden md:block">
                  <AccountDropDown userProfile={userProfile} userProfileBit={userProfileBit} userProfileGitLab={userProfileGitLab} />
                </div>
              )}
            </div>
            <TabsContent value="git">
              {fetchingToken || fetchingProfile || fetchingTokenBit || fetchingProfileBit || fetchingTokenGitLab || fetchingProfileGitLab ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded border px-5 py-10">
                  <Spinner size="large" />
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : (
                !token?.accessToken && (
                  <div className="flex flex-col justify-center gap-6 rounded-sm border px-4 py-8 md:items-center">
                    <div className="flex flex-col items-center justify-center">
                      <h1 className="text-lg font-bold text-primary">Connect Account</h1>
                      <p className="text-center text-sm text-muted-foreground">Connect a git provider to access your repositories.</p>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Button
                        onClick={() => {
                          setToken({ accessToken: null, refreshToken: null, type: "bitbucket", alreadyLoggedIn: token?.alreadyLoggedIn });

                          loginWithBitBucket();
                        }}
                        variant="outline"
                      >
                        <Bitbucket className="mr-2" />
                        Bitbucket
                      </Button>
                      <Button
                        onClick={() => {
                          setToken({ accessToken: null, refreshToken: null, type: "gitlab", alreadyLoggedIn: token?.alreadyLoggedIn });
                          handleGitLabLogin();
                        }}
                        variant="outline"
                      >
                        <GitlabFull className="mr-2" />
                        GitLab
                      </Button>
                      <Button
                        onClick={() => {
                          setToken({ accessToken: null, refreshToken: null, type: "github", alreadyLoggedIn: token?.alreadyLoggedIn });
                          if (token?.alreadyLoggedIn?.includes("github")) {
                            reLoginWithGithub();
                          } else {
                            loginWithGithub();
                          }
                        }}
                        variant="outline"
                      >
                        <GitIcon className="mr-2" />
                        Github
                      </Button>
                    </div>
                  </div>
                )
              )}
            </TabsContent>

            <TabsContent value="public" className="grid gap-6 lg:grid-cols-2">
              <CustomInput
                label="Repository URL"
                description="The link of the public repo to be deployed"
                placeholder="eg. https://github.com/username/repo.git"
                onChange={e =>
                  setValue(CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(protectedEnvironmentVariables.REPO_URL, e.target.value, false))
                }
              />
              <CustomInput
                label="Branch Name"
                description="The git branch branch which is to be deployed"
                placeholder="eg. main"
                onChange={e =>
                  setValue(CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(protectedEnvironmentVariables.BRANCH_NAME, e.target.value, false))
                }
              />
            </TabsContent>
          </Tabs>
        }

        {selectedTab === "git" && token?.accessToken && (
          <div className="grid gap-6 md:grid-cols-2">
            {token?.type === "github" ? (
              <>
                <GithubManager
                  setValue={setValue}
                  services={services}
                  control={control}
                  setDeploymentName={setDeploymentName}
                  deploymentName={deploymentName}
                  profile={userProfile}
                />
              </>
            ) : token?.type === "bitbucket" ? (
              <BitBucketManager
                loading={fetchingProfileBit}
                setValue={setValue}
                services={services}
                control={control}
                setDeploymentName={setDeploymentName}
                deploymentName={deploymentName}
                profile={userProfileBit}
              />
            ) : (
              <GitlabManager
                loading={fetchingProfileGitLab}
                setValue={setValue}
                services={services}
                control={control}
                setDeploymentName={setDeploymentName}
                deploymentName={deploymentName}
              />
            )}
          </div>
        )}
      </div>
      <RemoteBuildInstallConfig services={services} setValue={setValue} />
      <RemoteDeployEnvDropdown services={services} control={control} />
    </>
  );
};

export default RemoteRepositoryDeployManager;
