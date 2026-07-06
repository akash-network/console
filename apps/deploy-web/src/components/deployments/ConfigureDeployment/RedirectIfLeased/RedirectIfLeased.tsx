import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/navigation";

import Layout from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { UrlService } from "@src/utils/urlUtils";

function useGetDeployment(dseq: string | undefined) {
  return useServices().api.v1.getDeployment.useQuery({ dseq: dseq ?? "" }, { enabled: !!dseq });
}

export const DEPENDENCIES = { Layout, useRouter, useGetDeployment };

interface Props {
  dseq: string | undefined;
  children: ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Gates the configure screen for a resumed deployment: a dseq whose deployment already has leases is finished —
 * not still being quoted — so it belongs on the detail page. The children stay unmounted behind a spinner while
 * the deployment resolves, and throughout the redirect once it turns out leased, so the inert configure UI never
 * flashes. Scoped to the dseq present at mount, so a dseq created during this session (no leases yet, and which
 * redirects itself once deployed) never trips the gate. With no dseq the children render immediately without a
 * query. The owner is resolved from auth by the API, so this needs no wallet.
 */
export const RedirectIfLeased: FC<Props> = ({ dseq, children, dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const [resumeDseq] = useState(() => dseq);
  const { data, isLoading } = d.useGetDeployment(resumeDseq);
  const hasLeases = !!data?.data?.leases?.length;

  useEffect(
    function redirectWhenLeased() {
      if (resumeDseq && hasLeases) {
        router.replace(UrlService.deploymentDetails(resumeDseq));
      }
    },
    [resumeDseq, hasLeases, router]
  );

  if (resumeDseq && (isLoading || hasLeases)) {
    return (
      <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="large" />
        </div>
      </d.Layout>
    );
  }

  return <>{children}</>;
};
