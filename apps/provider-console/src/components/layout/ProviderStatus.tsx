import { Button } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useProvider } from "@src/context/ProviderContext";

export const ProviderStatus: React.FC = () => {
  const router = useRouter();
  const { isOnline, providerDetails, isLoadingProviderDetails, isLoadingOnlineStatus } = useProvider();

  const routeToRemedies = () => {
    if (providerDetails && !isOnline) {
      router.push("/remedies");
    }
  };

  const renderStatus = () => {
    if (isLoadingProviderDetails || isLoadingOnlineStatus) {
      return <span className="ml-2 items-center text-gray-500">Checking...</span>;
    }

    return isOnline ? <span className="ml-2 text-green-500">Online</span> : <span className="ml-2 text-red-500">Offline</span>;
  };

  return (
    <>
      <div className="text-sm">
        Status:
        <span onClick={routeToRemedies} className={`${providerDetails && !isOnline ? "cursor-pointer" : ""}`}>
          {renderStatus()}
        </span>
      </div>
      <div className="mr-4 flex text-sm md:h-auto">
        Audited:{" "}
        {providerDetails?.isAudited ? (
          <span className="text-green-500">Yes</span>
        ) : (
          <Button variant="link" className="ml-2 h-auto p-0 text-red-500" asChild>
            <a
              href="https://github.com/akash-network/community/issues?q=is%3Aissue+is%3Aopen+label%3A%22Provider+Audit%22"
              target="_blank"
              rel="noopener noreferrer"
            >
              Request Audit
            </a>
          </Button>
        )}
      </div>
    </>
  );
};
