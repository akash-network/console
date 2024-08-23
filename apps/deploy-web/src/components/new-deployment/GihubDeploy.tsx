import { Dispatch, useEffect, useState } from "react";
import { Button, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { Bitbucket, CoinsSwap, Github as GitIcon, GitlabFull, LogOut } from "iconoir-react";
import { useAtom } from "jotai";

import { useWhen } from "@src/hooks/useWhen";
import remoteDeployStore from "@src/store/remoteDeployStore";
import { ServiceType } from "@src/types";
import Advanced from "../remote-deploy/Advanced";
import { handleLogin, handleReLogin, useFetchAccessToken, useUserProfile } from "../remote-deploy/api/api";
import { handleLoginBit, useBitFetchAccessToken, useBitUserProfile } from "../remote-deploy/api/bitbucket-api";
import { handleGitLabLogin, useGitLabFetchAccessToken, useGitLabUserProfile } from "../remote-deploy/api/gitlab-api";
import Bit from "../remote-deploy/bitbucket/Bit";
import CustomInput from "../remote-deploy/CustomInput";
import Details from "../remote-deploy/Details";
import Github from "../remote-deploy/github/Github";
import GitLab from "../remote-deploy/gitlab/Gitlab";
import { appendEnv } from "../remote-deploy/utils";

const GithubDeploy = ({
  setValue,
  services,
  control,
  deploymentName,
  setDeploymentName,
  setIsRepoDataValidated
}: {
  setValue: any;
  services: ServiceType[];
  control: any;
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  setIsRepoDataValidated?: Dispatch<boolean>;
}) => {
  const [token, setToken] = useAtom(remoteDeployStore.tokens);
  console.log(services);

  const { data: userProfile, isLoading: fetchingProfile } = useUserProfile();
  const { data: userProfileBit, isLoading: fetchingProfileBit } = useBitUserProfile();
  const { data: userProfileGitLab, isLoading: fetchingProfileGitLab } = useGitLabUserProfile();
  console.log(userProfileGitLab);

  const { mutate: fetchAccessToken, isLoading: fetchingToken } = useFetchAccessToken();
  const { mutate: fetchAccessTokenBit, isLoading: fetchingTokenBit } = useBitFetchAccessToken();
  const { mutate: fetchAccessTokenGitLab, isLoading: fetchingTokenGitLab } = useGitLabFetchAccessToken();

  const [selectedTab, setSelectedTab] = useState("git");
  console.log(services, "services");

  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(true);
  }, []);

  useWhen(
    services?.[0]?.env?.find(e => e.key === "REPO_URL" && services?.[0]?.env?.find(e => e.key === "BRANCH_NAME")),
    () => {
      setIsRepoDataValidated?.(true);
    }
  );

  useEffect(() => {
    const url = new URL(window.location.href);

    const code = url.searchParams.get("code");

    if (code && !token?.access_token && open) {
      if (token?.type === "github") fetchAccessToken(code);
      if (token?.type === "bitbucket") fetchAccessTokenBit(code);
      if (token?.type === "gitlab") fetchAccessTokenGitLab(code);
    }
  }, [open]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-5 rounded border bg-card px-4 py-6 text-card-foreground md:px-6">
        <h1 className="font-semibold">Configure</h1>
        <div className="flex flex-col gap-5 rounded text-card-foreground md:border md:bg-card md:px-6 md:py-6">
          <h1 className="hidden font-semibold md:block">Source Code</h1>

          {
            <Tabs
              onValueChange={value => {
                setSelectedTab(value);
                setValue("services.0.env", []);
              }}
              defaultValue="git"
            >
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="git">Git Provider</TabsTrigger>
                  <TabsTrigger value="public">Public Git Repository</TabsTrigger>
                </TabsList>

                {token?.access_token && (
                  <div className="flex items-center gap-6">
                    <button
                      className="hidden items-center gap-2 text-primary md:flex"
                      onClick={() => {
                        setToken({
                          access_token: null,
                          refresh_token: null,
                          type: "github",
                          alreadyLoggedIn: token?.alreadyLoggedIn?.includes(token.type)
                            ? token.alreadyLoggedIn
                            : token?.alreadyLoggedIn && token?.alreadyLoggedIn?.length > 0
                              ? [...token.alreadyLoggedIn, token.type]
                              : [token.type]
                        });
                      }}
                    >
                      <CoinsSwap className="text-sm" /> Switch Git Provider
                    </button>
                    <button
                      className="hidden items-center gap-2 text-primary md:flex"
                      onClick={() => {
                        setToken({
                          access_token: null,
                          refresh_token: null,
                          type: "github",
                          alreadyLoggedIn: []
                        });
                      }}
                    >
                      <LogOut className="text-sm" /> Logout
                    </button>
                  </div>
                )}
              </div>
              <TabsContent value="git" className="md:mt-2">
                {fetchingToken || fetchingProfile || fetchingTokenBit || fetchingProfileBit || fetchingTokenGitLab || fetchingProfileGitLab ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded border px-5 py-10">
                    <Spinner size="large" />
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                ) : token?.access_token ? (
                  <div className="flex flex-col justify-center gap-2 rounded border px-5 py-10 md:items-center">
                    <h1 className="text-2xl font-semibold text-primary">
                      Welcome,{" "}
                      {token?.type === "bitbucket" ? userProfileBit?.display_name : token?.type === "gitlab" ? userProfileGitLab?.name : userProfile?.login}
                    </h1>
                    <p className="text-muted-foreground">Let’s Configure and Deploy your new web service ({token?.type})</p>
                  </div>
                ) : (
                  <div className="flex flex-col justify-center gap-6 rounded-sm border px-4 py-8 md:items-center">
                    <div className="flex flex-col items-center justify-center">
                      <h1 className="text-lg font-bold text-primary">Connect Account</h1>
                      <p className="text-center text-sm text-muted-foreground">Connect a git provider to access your repositories.</p>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Button
                        onClick={() => {
                          setToken({ access_token: null, refresh_token: null, type: "bitbucket", alreadyLoggedIn: token?.alreadyLoggedIn });

                          handleLoginBit();
                        }}
                        variant="outline"
                        className=""
                      >
                        <Bitbucket className="mr-2" />
                        Bitbucket
                      </Button>
                      <Button
                        onClick={() => {
                          setToken({ access_token: null, refresh_token: null, type: "gitlab", alreadyLoggedIn: token?.alreadyLoggedIn });
                          handleGitLabLogin();
                        }}
                        variant="outline"
                        className=""
                      >
                        <GitlabFull className="mr-2" />
                        GitLab
                      </Button>
                      <Button
                        onClick={() => {
                          setToken({ access_token: null, refresh_token: null, type: "github", alreadyLoggedIn: token?.alreadyLoggedIn });
                          if (token?.alreadyLoggedIn?.includes("github")) {
                            handleReLogin();
                          } else {
                            handleLogin();
                          }
                        }}
                        variant="outline"
                        className=""
                      >
                        <GitIcon className="mr-2" />
                        Github
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="public" className="flex flex-col gap-6">
                <CustomInput
                  label="Repository URL"
                  description="The link of the public repo to be deployed"
                  placeholder="eg. https://github.com/username/repo.git"
                  onChange={e => appendEnv("REPO_URL", e.target.value, false, setValue, services)}
                />
                <CustomInput
                  label="Branch Name"
                  description="The git branch branch which is to be deployed"
                  placeholder="eg. main"
                  onChange={e => appendEnv("BRANCH_NAME", e.target.value, false, setValue, services)}
                />
              </TabsContent>
            </Tabs>
          }
        </div>
        {selectedTab === "git" && token?.access_token && (
          <div className="grid gap-6 md:grid-cols-2">
            {token?.type === "github" ? (
              <>
                <Github
                  setValue={setValue}
                  services={services}
                  control={control}
                  setDeploymentName={setDeploymentName}
                  deploymentName={deploymentName}
                  profile={userProfile}
                />
              </>
            ) : token?.type === "bitbucket" ? (
              <Bit
                loading={fetchingProfileBit}
                setValue={setValue}
                services={services}
                control={control}
                setDeploymentName={setDeploymentName}
                deploymentName={deploymentName}
                profile={userProfileBit}
              />
            ) : (
              <GitLab
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
      <Details services={services} setValue={setValue} />
      <Advanced services={services} control={control} setValue={setValue} />
    </>
  );
};

export default GithubDeploy;
