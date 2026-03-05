import type { Dispatch } from "react";
import { useMemo } from "react";
import type { Control, UseFormSetValue } from "react-hook-form";
import { Button } from "@akashnetwork/ui/components";
import { Github as GitIcon } from "iconoir-react";
import { useAtom } from "jotai";

import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import { useServices } from "@src/context/ServicesProvider";
import { useInstallations, useRepos } from "@src/queries/useGithubQuery";
import { tokens } from "@src/store/remoteDeployStore";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { GitHubProfile } from "@src/types/remoteProfile";
import Repos from "../Repos";
import GithubBranches from "./GithubBranches";

const GithubManager = ({
  control,
  setValue,
  services,
  setDeploymentName,
  deploymentName,
  profile
}: {
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  control: Control<SdlBuilderFormValuesType>;

  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  services: ServiceType[];
  profile?: GitHubProfile;
}) => {
  const [token, setToken] = useAtom(tokens);
  const { githubService } = useServices();
  const { data: installationsIds, isLoading: isLoadingInstallations } = useInstallations();
  const { data: repos, isLoading: isLoadingRepos } = useRepos(installationsIds || []);
  const isLoading = isLoadingInstallations || isLoadingRepos;
  const mappedRepos = useMemo(
    () =>
      repos
        ?.filter(repo => repo.owner?.login === profile?.login || repo?.owner?.type === "Organization")
        ?.map(repo => ({
          name: repo.name,
          default_branch: repo?.default_branch,
          html_url: repo?.html_url,
          private: repo?.private,
          id: repo.id?.toString(),
          owner: repo?.owner
        })),
    [profile?.login, repos]
  );

  return (
    <LoadingBlocker isLoading={isLoadingInstallations}>
      {installationsIds?.length ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Repos
            repos={mappedRepos}
            setValue={setValue}
            isLoading={isLoading}
            services={services}
            setDeploymentName={setDeploymentName}
            deploymentName={deploymentName}
            profile={profile}
          />
          <GithubBranches services={services} control={control} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-gray-500">You don't have any Github apps installed. Please install one to continue.</p>
          <Button variant="outline" asChild>
            <a
              className="flex items-center no-underline hover:no-underline"
              href={githubService.getLoginUrl()}
              onClick={() => {
                setToken({ accessToken: null, refreshToken: null, type: "github", alreadyLoggedIn: token?.alreadyLoggedIn });
              }}
            >
              <GitIcon className="mr-2" />
              Install Github App
            </a>
          </Button>
        </div>
      )}
    </LoadingBlocker>
  );
};

export default GithubManager;
