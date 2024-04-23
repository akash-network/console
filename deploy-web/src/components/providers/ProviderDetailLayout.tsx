"use client";
import React, { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { UrlService } from "@src/utils/urlUtils";
import { useRouter } from "next/navigation";
import { ProviderSummary } from "./ProviderSummary";
import { ClientProviderDetailWithStatus } from "@src/types/provider";
import Link from "next/link";
import { useWallet } from "@src/context/WalletProvider";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { Button, buttonVariants } from "@src/components/ui/button";
import { NavArrowLeft, Refresh } from "iconoir-react";
import { cn } from "@src/utils/styleUtils";
import { Tabs, TabsList, TabsTrigger } from "@src/components/ui/tabs";
import { ErrorFallback } from "@src/components/shared/ErrorFallback";

export enum ProviderDetailTabs {
  DETAIL = "1",
  LEASES = "2",
  RAW = "3"
}

type Props = {
  page: ProviderDetailTabs;
  provider: Partial<ClientProviderDetailWithStatus>;
  address: string;
  refresh: () => void;
  children?: ReactNode;
};

// const useStyles = makeStyles()(theme => ({
//   tabsRoot: {
//     minHeight: "36px",
//     borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`,
//     "& button": {
//       minHeight: "36px"
//     }
//   },
//   selectedTab: {
//     fontWeight: "bold"
//   },
//   tabsContainer: {
//     justifyContent: "center"
//   }
// }));

const ProviderDetailLayout: React.FunctionComponent<Props> = ({ children, page, address, provider, refresh }) => {
  const router = useRouter();
  const { address: walletAddress } = useWallet();
  const previousRoute = usePreviousRoute();

  const handleTabChange = (newValue: ProviderDetailTabs) => {
    switch (newValue) {
      case ProviderDetailTabs.LEASES:
        router.push(UrlService.providerDetailLeases(address));
        break;
      case ProviderDetailTabs.RAW:
        router.push(UrlService.providerDetailRaw(address));
        break;
      case ProviderDetailTabs.DETAIL:
      default:
        router.push(UrlService.providerDetail(address));
        break;
    }
  };

  function handleBackClick() {
    if (previousRoute) {
      router.back();
    } else {
      router.push(UrlService.providers());
    }
  }

  return (
    <div className="pb-12">
      <div className="mb-2 flex items-center">
        <Button aria-label="back" onClick={handleBackClick} size="sm">
          <NavArrowLeft />
        </Button>
        <h1 className="ml-2 text-2xl font-bold">Provider detail</h1>

        <div className="ml-4">
          <Button aria-label="back" onClick={() => refresh()} size="sm">
            <Refresh />
          </Button>
        </div>

        {provider && walletAddress === address && (
          <div className="ml-4">
            <Link href={UrlService.providerDetailEdit(provider.owner as string)} className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
              Edit
            </Link>
          </div>
        )}
      </div>

      {provider && (
        <>
          <ProviderSummary provider={provider as ClientProviderDetailWithStatus} />

          <Tabs value={page} onValueChange={handleTabChange}>
            <TabsList className="mb-4 grid w-full grid-cols-4">
              <TabsTrigger value={ProviderDetailTabs.DETAIL}>Detail</TabsTrigger>
              <TabsTrigger value={ProviderDetailTabs.LEASES}>My Leases</TabsTrigger>
              <TabsTrigger value={ProviderDetailTabs.RAW}>Raw Data</TabsTrigger>
            </TabsList>

            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <div className="pt-8">{children}</div>
            </ErrorBoundary>
          </Tabs>
          {/* <Tabs
            value={page}
            onChange={handleTabChange}
            classes={{ root: classes.tabsRoot, flexContainer: classes.tabsContainer }}
            indicatorColor="secondary"
            textColor="secondary"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab value={ProviderDetailTabs.DETAIL} label="Detail" classes={{ selected: classes.selectedTab }} />
            <Tab value={ProviderDetailTabs.LEASES} label="My Leases" classes={{ selected: classes.selectedTab }} />
            <Tab value={ProviderDetailTabs.RAW} label="Raw Data" classes={{ selected: classes.selectedTab }} />
          </Tabs> */}
        </>
      )}
    </div>
  );
};

export default ProviderDetailLayout;
