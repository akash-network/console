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
      <div>
        Status:
        <span onClick={routeToRemedies} className={`${!isOnline ? "cursor-pointer" : ""}`}>
          {isOnline ? <span className="ml-2 text-green-500">Online</span> : <span className="ml-2 text-red-500">Offline</span>}
        </span>
      </div>
      <div className="flex-end mr-4 md:h-auto">
        Audited: <span className={providerDetails?.isAudited ? "text-green-500" : "text-red-500"}>{providerDetails?.isAudited ? "Yes" : "No"}</span>
      </div>
    </>
  );
};
