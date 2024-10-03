import { useState } from "react";

import { useBitPackageJson } from "@src/components/remote-deploy/remote-deploy-api-queries/bit-bucket-queries";
import { usePackageJson } from "@src/components/remote-deploy/remote-deploy-api-queries/github-queries";
import { useGitlabPackageJson } from "@src/components/remote-deploy/remote-deploy-api-queries/gitlab-queries";
import { supportedFrameworks } from "@src/config/remote-deploy.config";
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

  const { isLoading } = usePackageJson(setValueHandler, formatUrlWithoutInitialPath(currentRepoUrl), subFolder);
  const { isLoading: gitlabLoading, isFetching } = useGitlabPackageJson(setValueHandler, currentGitlabProjectId, subFolder);

  const { isLoading: bitbucketLoading } = useBitPackageJson(setValueHandler, formatUrlWithoutInitialPath(currentRepoUrl), currentBranchName, subFolder);

  function setValueHandler(data: PackageJson) {
    if (data?.dependencies) {
      setPackageJson(data);
      const cpus = (Object.keys(data?.dependencies ?? {})?.length / 10 / 2)?.toFixed(1);

      setCpus(+cpus > 2 ? +cpus : 2);
    } else {
      setPackageJson(null);
    }
  }
  return {
    currentFramework: supportedFrameworks.find(f => packageJson?.scripts?.dev?.includes(f.value)) ?? {
      title: "Other",
      value: "other"
    },
    isLoading: isLoading || gitlabLoading || bitbucketLoading || isFetching
  };
};

export default useRemoteDeployFramework;
