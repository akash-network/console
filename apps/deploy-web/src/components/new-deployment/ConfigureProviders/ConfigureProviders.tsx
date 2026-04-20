"use client";
import type { Dispatch, FC, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Card, Spinner } from "@akashnetwork/ui/components";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { ViewPanel } from "@src/components/shared/ViewPanel";
import { useSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useActiveFilters } from "@src/hooks/useActiveFilters";
import { useBidScreening } from "@src/hooks/useBidScreening";
import { useCertificate } from "@src/hooks/useCertificate/useCertificate";
import type { FilterSnapshot } from "@src/hooks/useFilterHistory";
import { useFilterHistory } from "@src/hooks/useFilterHistory";
import { useSdlServiceManager } from "@src/hooks/useSdlServiceManager/useSdlServiceManager";
import { useGpuPrices } from "@src/queries/useGpuQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { TemplateCreation } from "@src/types";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { memoryUnits } from "@src/utils/akash/units";
import { deploymentData } from "@src/utils/deploymentData";
import { appendAuditorRequirement, replaceSdlDenom } from "@src/utils/deploymentData/v1beta3";
import type { MockQuote } from "@src/utils/mockQuoteGenerator";
import { generateMockQuote } from "@src/utils/mockQuoteGenerator";
import { getDefaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { sdlFormToBidScreeningRequest } from "@src/utils/sdlFormToBidScreeningRequest";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import { ProvidersCard } from "./cards/ProvidersCard";
import { ConfigureProvidersHeader } from "./ConfigureProvidersHeader";
import { FilterActionBar } from "./FilterActionBar";
import { FilterSnackbar } from "./FilterSnackbar";
import type { EnrichedProvider } from "./ProviderTable";
import { QuoteModal } from "./QuoteModal";
import { ServiceTabBar } from "./ServiceTabBar";
import { WorkloadConfigPanel } from "./WorkloadConfigPanel";

const FAVORITE_PROVIDERS_KEY = "akash_favorite_providers";

function getFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITE_PROVIDERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function toggleFavoriteStorage(owner: string): string[] {
  const current = getFavorites();
  const next = current.includes(owner) ? current.filter(o => o !== owner) : [...current, owner];
  localStorage.setItem(FAVORITE_PROVIDERS_KEY, JSON.stringify(next));
  return next;
}

type Props = {
  selectedTemplate: TemplateCreation | null;
  onTemplateSelected: Dispatch<TemplateCreation | null>;
  editedManifest: string | null;
  setEditedManifest: Dispatch<SetStateAction<string>>;
};

export const ConfigureProviders: FC<Props> = ({ selectedTemplate, editedManifest, setEditedManifest }) => {
  const router = useRouter();
  const { hasComponent } = useSdlBuilder();
  const { analyticsService, chainApiHttpClient, deploymentLocalStorage } = useServices();
  const { address, signAndBroadcastTx } = useWallet();
  const wallet = useWallet();
  const { genNewCertificateIfLocalIsInvalid, updateSelectedCertificate } = useCertificate();
  const { data: gpuPrices } = useGpuPrices();
  const { data: allProviders } = useProviderList();

  const [deploymentName, setDeploymentName] = useState(selectedTemplate?.name ?? "hello-world");
  const [isCreatingDeployment, setIsCreatingDeployment] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());

  const [placementFilters, setPlacementFilters] = useState<PlacementFilters>({
    maxPrice: 0.1,
    auditedBy: [],
    regions: []
  });

  // Quote modal state
  const [quoteProvider, setQuoteProvider] = useState<EnrichedProvider | null>(null);
  const [quoteData, setQuoteData] = useState<MockQuote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ message: string; action: "undo" | "redo" | null; visible: boolean }>({
    message: "",
    action: null,
    visible: false
  });

  // Form setup — reuses existing SdlBuilder form schema
  const form = useForm<SdlBuilderFormValuesType>({
    defaultValues: {
      services: [getDefaultService({ supportsSSH: hasComponent("ssh") })],
      imageList: [],
      hasSSHKey: hasComponent("ssh")
    },
    resolver: zodResolver(SdlBuilderFormValuesSchema)
  });
  const { control, watch, setValue, getValues, reset } = form;
  const formServices = watch("services");
  const serviceManager = useSdlServiceManager({ control });
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  const currentService = formServices[activeServiceIndex] ?? formServices[0];

  const {
    filters: activeFilters,
    handleDismiss: handleDismissFilter,
    handleClearAll: handleClearAllFilters
  } = useActiveFilters({
    services: formServices as ServiceType[],
    placementFilters,
    setValue,
    onPlacementChange: setPlacementFilters
  });

  // Hydrate form from template
  useEffect(() => {
    if (editedManifest) {
      try {
        const services = importSimpleSdl(editedManifest);
        setValue("services", services as ServiceType[]);
      } catch {
        // Template parsing failed — keep defaults
      }
    }
  }, [editedManifest, setValue]);

  // Keep SDL in sync
  useEffect(() => {
    const { unsubscribe } = watch(data => {
      try {
        const sdl = generateSdl(data.services as ServiceType[]);
        setEditedManifest(sdl);
      } catch {
        // Ignore generation errors during editing
      }
    });
    return unsubscribe;
  }, [watch, setEditedManifest]);

  // Build bid-screening request from current applied snapshot
  const [appliedRequest, setAppliedRequest] = useState<ReturnType<typeof sdlFormToBidScreeningRequest> | null>(null);

  // Initial bid-screening call
  useEffect(() => {
    const values = getValues();
    const request = sdlFormToBidScreeningRequest(values, placementFilters);
    setAppliedRequest(request);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: bidScreeningData, isFetching: isBidScreeningLoading } = useBidScreening(appliedRequest);

  // Filter history — initialize once we have first results
  const filterHistory = useFilterHistory(getValues(), placementFilters, bidScreeningData?.total ?? 0);

  // Enrich bid-screening providers with metadata from the full provider list
  const enrichedProviders: EnrichedProvider[] = useMemo(() => {
    if (!bidScreeningData?.providers || !allProviders) return [];
    const providerMap = new Map(allProviders.map(p => [p.owner, p]));

    return bidScreeningData.providers
      .filter(bp => {
        const full = providerMap.get(bp.owner);
        return full?.isOnline;
      })
      .map(bp => {
        const full = providerMap.get(bp.owner)!;
        return {
          ...bp,
          name: full.name ?? null,
          location: `${full.ipRegion || full.ipCountryCode}`,
          countryCode: full.ipCountryCode ?? "",
          uptime7d: full.uptime7d ?? 0,
          isAudited: full.isAudited ?? false,
          gpuModels: full.gpuModels?.map(g => ({ vendor: g.vendor, model: g.model })) ?? [],
          isFavorite: favorites.includes(bp.owner),
          stats: full.stats,
          ipRegion: full.ipRegion,
          ipRegionCode: full.ipRegionCode,
          ipCountry: full.ipCountry,
          ipCountryCode: full.ipCountryCode,
          attributes: full.attributes
        };
      });
  }, [bidScreeningData, allProviders, favorites]);

  // Aggregated template description across all services (app-level totals)
  const templateDescription = useMemo(() => {
    if (!formServices.length) return "";

    const totalCpu = formServices.reduce((sum, s) => sum + (Number(s.profile.cpu) || 0), 0);

    const totalRamBytes = formServices.reduce((sum, s) => {
      const unit = memoryUnits.find(u => u.suffix.toLowerCase() === (s.profile.ramUnit || "Mi").toLowerCase());
      return sum + (Number(s.profile.ram) || 0) * (unit?.value ?? 1024 ** 2);
    }, 0);
    const ramMib = totalRamBytes / 1024 ** 2;
    const ramDisplay = ramMib >= 1024 ? `${+(ramMib / 1024).toFixed(1)}Gi` : `${Math.round(ramMib)}Mi`;

    const totalGpu = formServices.reduce((sum, s) => sum + (s.profile.hasGpu ? Number(s.profile.gpu) || 1 : 0), 0);

    const parts = [`${+totalCpu.toFixed(2)} vCPU`, ramDisplay];
    if (totalGpu > 0) parts.push(`${totalGpu}× GPU`);
    return parts.join(" · ");
  }, [formServices]);

  // Pending changes count
  const pendingChanges = filterHistory.pendingChanges(getValues(), placementFilters);

  const handleApply = useCallback(() => {
    const values = getValues();
    const request = sdlFormToBidScreeningRequest(values, placementFilters);
    setAppliedRequest(request);
    // We'll update the filter history once the query resolves
    filterHistory.apply(values, placementFilters, enrichedProviders.length);
    setSnackbar({
      message: `Filter applied. ${enrichedProviders.length} providers match.`,
      action: "undo",
      visible: true
    });
  }, [getValues, placementFilters, filterHistory, enrichedProviders.length]);

  const restoreSnapshot = useCallback(
    (snapshot: FilterSnapshot) => {
      reset(snapshot.formValues, { keepDefaultValues: true });
      setPlacementFilters(snapshot.placementFilters);
      setAppliedRequest(sdlFormToBidScreeningRequest(snapshot.formValues, snapshot.placementFilters));
    },
    [reset]
  );

  const handleUndo = useCallback(() => {
    const snapshot = filterHistory.undo();
    if (snapshot) {
      restoreSnapshot(snapshot);
      setSnackbar({ message: "Filter reverted.", action: "redo", visible: true });
    }
  }, [filterHistory, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    const snapshot = filterHistory.redo();
    if (snapshot) {
      restoreSnapshot(snapshot);
      setSnackbar({ message: `Filter re-applied. ${snapshot.resultCount} providers match.`, action: "undo", visible: true });
    }
  }, [filterHistory, restoreSnapshot]);

  const handleRevert = useCallback(() => {
    const snapshot = filterHistory.currentSnapshot;
    if (snapshot) {
      reset(snapshot.formValues, { keepDefaultValues: true });
      setPlacementFilters(snapshot.placementFilters);
    }
  }, [filterHistory, reset]);

  const handleToggleFavorite = useCallback((owner: string) => {
    setFavorites(toggleFavoriteStorage(owner));
  }, []);

  const handleGetQuote = useCallback(
    (provider: EnrichedProvider) => {
      setQuoteProvider(provider);
      setQuoteData(null);
      setIsQuoteLoading(true);
      // Simulate Stage 2 API call
      setTimeout(() => {
        const values = getValues();
        const request = sdlFormToBidScreeningRequest(values, placementFilters);
        const quote = generateMockQuote(request.data.resources, 0.35);
        setQuoteData(quote);
        setIsQuoteLoading(false);
      }, 500);
    },
    [getValues, placementFilters]
  );

  const handleAcceptQuote = useCallback(async () => {
    if (!editedManifest) return;

    try {
      setIsCreatingDeployment(true);
      let sdl = editedManifest;

      if (wallet.isManaged) {
        sdl = appendAuditorRequirement(sdl);
        if (wallet.denom !== "uakt") {
          sdl = replaceSdlDenom(sdl, wallet.denom);
        }
      }

      const [dd, newCert] = await Promise.all([deploymentData.NewDeploymentData(chainApiHttpClient, sdl, null, address), genNewCertificateIfLocalIsInvalid()]);

      if (!dd) return;

      const messages: EncodeObject[] = [];
      if (newCert) {
        messages.push(TransactionMessageData.getCreateCertificateMsg(address, newCert.cert, newCert.publicKey));
      }
      messages.push(TransactionMessageData.getCreateDeploymentMsg(dd));

      const response = await signAndBroadcastTx(messages);

      if (response) {
        if (newCert) await updateSelectedCertificate(newCert);

        deploymentLocalStorage.update(address, dd.deploymentId.dseq, {
          manifest: sdl,
          manifestVersion: dd.hash,
          name: deploymentName
        });

        router.replace(UrlService.newDeployment({ step: RouteStep.createLeases, dseq: dd.deploymentId.dseq }));

        analyticsService.track("create_deployment", {
          category: "deployments",
          label: "Create deployment from bid precheck"
        });
      }
    } finally {
      setIsCreatingDeployment(false);
      setQuoteProvider(null);
    }
  }, [
    editedManifest,
    wallet,
    chainApiHttpClient,
    address,
    signAndBroadcastTx,
    genNewCertificateIfLocalIsInvalid,
    updateSelectedCertificate,
    deploymentLocalStorage,
    deploymentName,
    router,
    analyticsService
  ]);

  if (!currentService) return <Spinner size="medium" />;

  return (
    <div className="flex h-full flex-col">
      <ConfigureProvidersHeader
        deploymentName={deploymentName}
        onDeploymentNameChange={setDeploymentName}
        templateDescription={templateDescription}
        matchCount={enrichedProviders.length}
        totalProviders={allProviders?.filter(p => p.isOnline).length ?? 0}
        canUndo={filterHistory.canUndo}
        canRedo={filterHistory.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <ViewPanel stickToBottom className="grid" style={{ gridTemplateColumns: "380px 1fr" }}>
        {/* Left panel: services card + scrollable config stack + sticky action bar */}
        <div className="flex flex-col overflow-hidden">
          <div className="p-3 pb-0">
            <Card className="overflow-hidden">
              <ServiceTabBar
                services={formServices as ServiceType[]}
                activeIndex={activeServiceIndex}
                onSelect={setActiveServiceIndex}
                onAdd={() => {
                  serviceManager.add();
                  setActiveServiceIndex(formServices.length);
                }}
                onRemove={index => {
                  serviceManager.remove(index);
                  setActiveServiceIndex(prev => (prev >= formServices.length - 1 ? Math.max(0, formServices.length - 2) : prev));
                }}
                onRename={(index, name) => setValue(`services.${index}.title`, name)}
              />
            </Card>
          </div>
          <div className="flex-1 overflow-y-auto">
            <WorkloadConfigPanel
              control={control}
              currentService={currentService}
              services={formServices as ServiceType[]}
              serviceIndex={activeServiceIndex}
              setValue={setValue}
              gpuPrices={gpuPrices}
              placementFilters={placementFilters}
              onPlacementChange={setPlacementFilters}
            />
          </div>
          <FilterActionBar
            pendingChanges={pendingChanges}
            matchCount={enrichedProviders.length}
            isLoading={isBidScreeningLoading}
            onRevert={handleRevert}
            onApply={handleApply}
          />
        </div>

        {/* Right panel: padded wrapper around the providers card */}
        <div className="flex flex-col overflow-hidden p-3 pl-0">
          <ProvidersCard
            providers={enrichedProviders}
            total={bidScreeningData?.total ?? 0}
            isLoading={isBidScreeningLoading}
            placementFilters={placementFilters}
            activeFilters={activeFilters}
            onDismissFilter={handleDismissFilter}
            onClearAllFilters={handleClearAllFilters}
            onGetQuote={handleGetQuote}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
      </ViewPanel>

      <FilterSnackbar
        message={snackbar.message}
        visible={snackbar.visible}
        action={snackbar.action}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDismiss={() => setSnackbar(prev => ({ ...prev, visible: false }))}
      />

      <QuoteModal
        open={!!quoteProvider}
        provider={
          quoteProvider
            ? {
                name: quoteProvider.name ?? quoteProvider.hostUri.replace("https://", ""),
                location: quoteProvider.location,
                auditor: quoteProvider.isAudited ? "Akash Network" : null
              }
            : null
        }
        quote={quoteData}
        services={formServices.map(s => ({
          title: s.title,
          image: s.image,
          cpu: s.profile.cpu,
          gpu: s.profile.hasGpu ? s.profile.gpu : undefined,
          ram: s.profile.ram,
          ramUnit: s.profile.ramUnit,
          storageSize: s.profile.storage?.[0]?.size ?? "-",
          storageUnit: s.profile.storage?.[0]?.unit ?? ""
        }))}
        isLoading={isQuoteLoading}
        onClose={() => setQuoteProvider(null)}
        onAccept={handleAcceptQuote}
        isAccepting={isCreatingDeployment}
      />
    </div>
  );
};
