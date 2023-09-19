import React, { useEffect, useState } from "react";
import {
  useAuditors as useAuditorsQuery,
  useDataNodeProviders as useDataNodeProvidersQuery,
  useProviders as useProvidersQuery
} from "@src/queries/useProvidersQuery";
import { Auditor, MergedProvider } from "@src/types/provider";
import { useSettings } from "../SettingsProvider";

type ContextType = {
  isLoadingAuditors: boolean;
  auditors: Array<Auditor>;
  providers: Array<MergedProvider>;
  isLoadingProviders: boolean;
  getProviders: () => void;
};

const AkashProviderContext = React.createContext<Partial<ContextType>>({});

export const AkashProvider = ({ children }) => {
  const [mergedProviders, setMergedProviders] = useState(null);
  const { data: auditors, isFetching: isLoadingAuditors } = useAuditorsQuery();
  const { data: dataNodeProviders, isFetching: isFetchingDataNodeProviders, refetch: fetchDataNodeProviders } = useDataNodeProvidersQuery({ enabled: false });
  const { data: providers, isFetching: isFetchingProviders, refetch: fetchProviders } = useProvidersQuery({ enabled: false });
  const { isSettingsInit } = useSettings();

  useEffect(() => {
    if (isSettingsInit) {
      getProviders();
    }
  }, [isSettingsInit]);

  const getProviders = () => {
    fetchDataNodeProviders();
    fetchProviders();
  };

  useEffect(() => {
    if (providers && dataNodeProviders && auditors) {
      // TODO Once data-node provider endpoint it finalized, only use data node provider
      const _mergedProviders = providers.map(provider => {
        const dataNodeProvider = dataNodeProviders.find(x => x.owner === provider.owner);

        if (dataNodeProvider) {
          const isAudited = dataNodeProvider.attributes.some(a => a.auditedBy?.some(x => auditors.some(y => y.address === x)));
          // Merge the data from akash node + data node
          return {
            ...provider,
            ...dataNodeProvider,
            isActive: true,
            isAudited
          };
        } else {
          return provider;
        }
      });

      setMergedProviders(_mergedProviders);
    } else if (providers && !dataNodeProviders) {
      setMergedProviders(providers);
    }
  }, [providers, dataNodeProviders, auditors]);

  return (
    <AkashProviderContext.Provider
      value={{
        isLoadingAuditors,
        auditors,
        providers: mergedProviders,
        isLoadingProviders: isFetchingDataNodeProviders || isFetchingProviders,
        getProviders
      }}
    >
      {children}
    </AkashProviderContext.Provider>
  );
};

export const useAkashProviders = () => {
  return { ...React.useContext(AkashProviderContext) };
};
