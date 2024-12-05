import { Button } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useProviderDetails } from "@src/queries/useProviderQuery";

export const ProviderStatus: React.FC = () => {
  const router = useRouter();
  const { isOnline } = useWallet();
  const { address }: any = useSelectedChain();
  const { data: providerDetails }: any = useProviderDetails(address);

  const routeToRemedies = () => {
    if (!isOnline) {
      router.push("/remedies");
    }
  };

  return (
    <>
      <div className="text-sm">
        Status:
        <span onClick={routeToRemedies} className={`${!isOnline ? "cursor-pointer" : ""}`}>
          {isOnline ? <span className="ml-2 text-green-500">Online</span> : <span className="ml-2 text-red-500">Offline</span>}
        </span>
      </div>
      <div className="flex-end mr-4 text-sm md:h-auto">
        Audited:{" "}
        {providerDetails?.isAudited ? (
          <span className="text-green-500">Yes</span>
        ) : (
          <Button variant="link" className="h-auto p-0 text-red-500" asChild>
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
