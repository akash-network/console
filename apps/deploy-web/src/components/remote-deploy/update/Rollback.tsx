import { useMemo } from "react";
import { Control } from "react-hook-form";

import { protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import { useCommits } from "@src/queries/useGithubQuery";
import { useGitLabCommits } from "@src/queries/useGitlabQuery";
import { formatUrlWithoutInitialPath } from "@src/services/remote-deploy/remote-deployment-controller.service";
import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { RollBackType } from "@src/types/remotedeploy";
import { useBitBucketCommits } from "../../../queries/useBitBucketQuery";
import RollbackModal from "./RollbackModal";

const Rollback = ({ services, control }: { services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const repoUrl = services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.REPO_URL)?.value;
  const branchName = services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.BRANCH_NAME)?.value;

  const { data } = useCommits(repoUrl?.replace("https://github.com/", ""), branchName);
  const { data: labCommits } = useGitLabCommits(services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.GITLAB_PROJECT_ID)?.value, branchName);
  const { data: bitbucketCommits } = useBitBucketCommits(formatUrlWithoutInitialPath(repoUrl));
  const commits: RollBackType[] | null = useMemo(() => {
    if (data?.length) {
      return formatCommits(data, commit => ({
        name: commit.commit.message,
        value: commit.sha,
        date: new Date(commit?.commit?.author?.date || "")
      }));
    } else if (labCommits?.length) {
      return formatCommits(labCommits, commit => ({
        name: commit.title,
        value: commit.id,
        date: new Date(commit.authored_date)
      }));
    } else if (bitbucketCommits?.values?.length) {
      return formatCommits(bitbucketCommits.values, commit => ({
        name: commit.message,
        value: commit.hash,
        date: new Date(commit.date)
      }));
    }
    return null;
  }, [data, labCommits, bitbucketCommits]);

  function formatCommits<T>(commits: T[], mapFn: (commit: T) => RollBackType): RollBackType[] {
    return commits.map(mapFn);
  }

  return <RollbackModal commits={commits} control={control} />;
};
export default Rollback;
