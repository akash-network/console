import { useCallback, useEffect, useState } from "react";

import { supportedFrameworks } from "@src/config/remote-deploy.config";
import { useBitPackageJson } from "@src/queries/useBitBucketQuery";
import { usePackageJson } from "@src/queries/useGithubQuery";
import { useGitlabPackageJson } from "@src/queries/useGitlabQuery";
import { formatUrlWithoutInitialPath } from "@src/services/remote-deploy/remote-deployment-controller.service";
import { PackageJson } from "@src/types/remotedeploy";

const useRemoteDeployFramework = ({
  currentRepoUrl,
  currentBranchName,
  currentGitlabProjectId,
  subFolder,
  setCpus
}: {
  currentRepoUrl?: string;
  currentBranchName?: string;
  currentGitlabProjectId?: string;
  subFolder?: string;
  setCpus: (cpu: number) => void;
}) => {
  const [packageJson, setPackageJson] = useState<PackageJson | null>(null);

  const setValueHandler = useCallback(
    (data: PackageJson) => {
      if (data?.dependencies) {
        setPackageJson(data);
        const cpus = (Object.keys(data?.dependencies ?? {})?.length / 10 / 2)?.toFixed(1);

        setCpus(+cpus > 2 ? +cpus : 2);
      } else {
        setPackageJson(null);
      }
    },
    [setCpus]
  );

  const { isLoading, data: gitHubPackagJson } = usePackageJson(formatUrlWithoutInitialPath(currentRepoUrl), subFolder);
  useEffect(() => {
    if (gitHubPackagJson?.content) {
      setValueHandler(JSON.parse(atob(gitHubPackagJson.content)));
    }
  }, [gitHubPackagJson, setValueHandler]);

  const { isLoading: gitlabLoading, isFetching, data: gitlabPackageJson } = useGitlabPackageJson(currentGitlabProjectId, subFolder);
  useEffect(() => {
    if (gitlabPackageJson?.content) {
      setValueHandler(JSON.parse(atob(gitlabPackageJson.content)));
    }
  }, [gitlabPackageJson, setValueHandler]);

  const { isLoading: bitbucketLoading, data: bitbucketPackageJson } = useBitPackageJson(
    formatUrlWithoutInitialPath(currentRepoUrl),
    currentBranchName,
    subFolder
  );
  useEffect(() => {
    if (bitbucketPackageJson) {
      setValueHandler(bitbucketPackageJson);
    }
  }, [bitbucketPackageJson, setValueHandler]);

  return {
    currentFramework: supportedFrameworks.find(f => packageJson?.scripts?.dev?.includes(f.value)) ?? {
      title: "Other",
      value: "other"
    },
    isLoading: isLoading || gitlabLoading || bitbucketLoading || isFetching
  };
};

export default useRemoteDeployFramework;
