"use client";
import { useState, useEffect } from "react";
import { useSettings } from "@src/context/SettingsProvider";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useWallet } from "@src/context/WalletProvider";
import { useNetworkCapacity, useProviderList } from "@src/queries/useProvidersQuery";
import { ProviderMap } from "@src/app/providers/ProviderMap";
import { ProviderTable } from "@src/app/providers/ProviderTable";
import dynamic from "next/dynamic";
import { UrlService } from "@src/utils/urlUtils";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { ClientProviderList } from "@src/types/provider";
import { useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@src/components/shared/PageContainer";
import Spinner from "@src/components/shared/Spinner";
import { Button } from "@src/components/ui/button";
import { OpenNewWindow, Refresh } from "iconoir-react";
import { Checkbox, CheckboxWithLabel } from "@src/components/ui/checkbox";
import { CustomPagination } from "@src/components/shared/CustomPagination";

const NetworkCapacity = dynamic(() => import("../../components/providers/NetworkCapacity"), {
  ssr: false
});

type Props = {};

// const useStyles = makeStyles()(theme => ({
//   root: {
//     "& .MuiPagination-ul": {
//       justifyContent: "center"
//     }
//   },
//   title: {
//     fontSize: "1.5rem",
//     fontWeight: "bold"
//   },
//   checkbox: {
//     padding: "4px"
//   },
//   selectFormControl: {
//     flexBasis: "250px",
//     marginLeft: "1rem"
//   }
// }));

type SortId = "active-leases-desc" | "active-leases-asc" | "my-leases-desc" | "my-active-leases-desc" | "gpu-available-desc";

const sortOptions: { id: SortId; title: string }[] = [
  { id: "active-leases-desc", title: "Active Leases (desc)" },
  { id: "active-leases-asc", title: "Active Leases (asc)" },
  { id: "my-leases-desc", title: "Your Leases (desc)" },
  { id: "my-active-leases-desc", title: "Your Active Leases (desc)" },
  { id: "gpu-available-desc", title: "GPUs Available (desc)" }
];

export const ProviderList: React.FunctionComponent<Props> = ({}) => {
  const { address } = useWallet();
  const [page, setPage] = useState(1);
  const [isFilteringActive, setIsFilteringActive] = useState(true);
  const [isFilteringFavorites, setIsFilteringFavorites] = useState(false);
  const [isFilteringAudited, setIsFilteringAudited] = useState(false);
  const [filteredProviders, setFilteredProviders] = useState<Array<ClientProviderList>>([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState<SortId>("active-leases-desc");
  const [search, setSearch] = useState("");
  const { settings } = useSettings();
  const { favoriteProviders } = useLocalNotes();
  const { apiEndpoint } = settings;
  const { data: providers, isFetching: isLoadingProviders, refetch: getProviders } = useProviderList();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });
  const { data: networkCapacity, isFetching: isLoadingNetworkCapacity } = useNetworkCapacity();
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const currentPageProviders = filteredProviders.slice(start, end);
  const pageCount = Math.ceil(filteredProviders.length / rowsPerPage);
  const selectedNetwork = useSelectedNetwork();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sortQuery = searchParams?.get("sort");

  useEffect(() => {
    getLeases();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEndpoint]);

  useEffect(() => {
    if (sortQuery && sortOptions.some(x => x.id === sortQuery)) {
      setSort(sortQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortQuery]);

  useEffect(() => {
    if (providers) {
      let filteredProviders = [...providers].map(p => {
        const numberOfDeployments = leases?.filter(d => d.provider === p.owner).length || 0;
        const numberOfActiveLeases = leases?.filter(d => d.provider === p.owner && d.state === "active").length || 0;

        return {
          ...p,
          userLeases: numberOfDeployments,
          userActiveLeases: numberOfActiveLeases
        };
      });

      // Filter for search
      if (search) {
        filteredProviders = filteredProviders.filter(x => x.hostUri?.includes(search.toLowerCase()) || x.owner?.includes(search.toLowerCase()));
      }

      if (isFilteringActive) {
        filteredProviders = filteredProviders.filter(x => x.isOnline);
      }

      if (isFilteringFavorites) {
        filteredProviders = filteredProviders.filter(x => favoriteProviders.some(y => y === x.owner));
      }

      if (isFilteringAudited) {
        filteredProviders = filteredProviders.filter(x => x.isAudited);
      }

      filteredProviders = filteredProviders.sort((a, b) => {
        if (sort === "active-leases-desc") {
          return b.leaseCount - a.leaseCount;
        } else if (sort === "active-leases-asc") {
          return a.leaseCount - b.leaseCount;
        } else if (sort === "my-leases-desc") {
          return b.userLeases - a.userLeases;
        } else if (sort === "my-active-leases-desc") {
          return b.userActiveLeases - a.userActiveLeases;
        } else if (sort === "gpu-available-desc") {
          const totalGpuB = b.availableStats.gpu + b.pendingStats.gpu + b.activeStats.gpu;
          const totalGpuA = a.availableStats.gpu + a.pendingStats.gpu + a.activeStats.gpu;
          return totalGpuB - totalGpuA;
        } else {
          return 1;
        }
      });

      setFilteredProviders(filteredProviders);
    }
  }, [providers, isFilteringActive, isFilteringFavorites, isFilteringAudited, favoriteProviders, search, sort, leases]);

  const refresh = () => {
    getProviders();
  };

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const onIsFilteringActiveClick = (value: boolean) => {
    setPage(1);
    setIsFilteringActive(value);
  };

  const onIsFilteringFavoritesClick = (value: boolean) => {
    setPage(1);
    setIsFilteringFavorites(value);
  };

  const onIsFilteringAuditedClick = (value: boolean) => {
    setPage(1);
    setIsFilteringAudited(value);
  };

  const onSearchChange = event => {
    const value = event.target.value;
    setSearch(value);
  };

  const handleSortChange = event => {
    const value = event.target.value;

    router.replace(UrlService.providers(value), { scroll: false });
  };

  const handleRowsPerPageChange = event => {
    const value = event.target.value;

    setRowsPerPage(value);
  };

  return (
    <PageContainer isLoading={isLoadingProviders || isLoadingLeases || isLoadingNetworkCapacity}>
      <h1 className="mb-8 text-2xl font-bold">Network Capacity</h1>

      {providers && providers.length > 0 && (
        <h3 className="mb-8 text-lg text-muted-foreground">
          <span className="text-xl font-bold text-primary">{providers.filter(x => x.isOnline).length}</span> active providers on {selectedNetwork.title}
        </h3>
      )}

      {!providers && isLoadingProviders && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="large" />
        </div>
      )}

      {providers && (
        <div className="mx-auto max-w-[800px]">
          <ProviderMap providers={providers} />
        </div>
      )}

      {providers && networkCapacity && (
        <div className="mb-8">
          <NetworkCapacity
            activeCPU={networkCapacity.activeCPU}
            pendingCPU={networkCapacity.pendingCPU}
            totalCPU={networkCapacity.totalCPU}
            activeGPU={networkCapacity.activeGPU}
            pendingGPU={networkCapacity.pendingGPU}
            totalGPU={networkCapacity.totalGPU}
            activeMemory={networkCapacity.activeMemory}
            pendingMemory={networkCapacity.pendingMemory}
            totalMemory={networkCapacity.totalMemory}
            activeStorage={networkCapacity.activeStorage}
            pendingStorage={networkCapacity.pendingStorage}
            totalStorage={networkCapacity.totalStorage}
          />
        </div>
      )}

      {(providers?.length || 0) > 0 && (
        <>
          <div className="mr-4">
            <Button onClick={() => window.open("https://docs.akash.network/providers", "_blank")} size="lg" color="secondary">
              Become a provider
              <OpenNewWindow className="ml-2 text-sm" />
            </Button>
          </div>

          <div>
            <div className="flex flex-wrap items-center pt-4">
              <div className="flex items-center">
                <h3 className="text-2xl font-bold">Providers</h3>

                <div className="ml-4">
                  <Button aria-label="back" onClick={() => refresh()} size="icon">
                    <Refresh />
                  </Button>
                </div>
              </div>

              <div className="flex items-center md:ml-8">
                <div>
                  <CheckboxWithLabel checked={isFilteringActive} onCheckedChange={onIsFilteringActiveClick} label="Active" color="secondary" />
                </div>
                <div marginLeft="1rem">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isFilteringFavorites}
                        onChange={onIsFilteringFavoritesClick}
                        color="secondary"
                        size="small"
                        classes={{ root: classes.checkbox }}
                      />
                    }
                    label="Favorites"
                  />
                </div>
                <div marginLeft="1rem">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isFilteringAudited}
                        onChange={onIsFilteringAuditedClick}
                        color="secondary"
                        size="small"
                        classes={{ root: classes.checkbox }}
                      />
                    }
                    label="Audited"
                  />
                </div>
              </div>
            </div>

            <div sx={{ padding: "1rem 0", display: "flex", alignItems: "center", flexDirection: { xs: "column", sm: "column", md: "row" } }}>
              <TextField
                label="Search Providers"
                value={search}
                onChange={onSearchChange}
                type="text"
                variant="outlined"
                fullWidth
                size="small"
                InputProps={{
                  endAdornment: search && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch("")}>
                        <CloseIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <div
                sx={{
                  display: "flex",
                  width: { xs: "100%", sm: "100%", md: "auto" },
                  alignItems: { xs: "start", sm: "start", md: "center" },
                  marginTop: { xs: "1rem", sm: "1rem", md: 0 }
                }}
              >
                <FormControl sx={{ flexBasis: "100px", marginLeft: { xs: 0, sm: 0, md: "1rem" } }}>
                  <InputLabel id="sort-select-label">Rows per page</InputLabel>
                  <Select
                    labelId="sort-select-label"
                    label="Rows per page"
                    value={rowsPerPage}
                    onChange={handleRowsPerPageChange}
                    variant="outlined"
                    size="small"
                  >
                    <MenuItem value={10}>
                      <Typography variant="caption">10</Typography>
                    </MenuItem>
                    <MenuItem value={20}>
                      <Typography variant="caption">20</Typography>
                    </MenuItem>
                    <MenuItem value={50}>
                      <Typography variant="caption">50</Typography>
                    </MenuItem>
                  </Select>
                </FormControl>

                <FormControl className={classes.selectFormControl}>
                  <InputLabel id="sort-select-label">Sort by</InputLabel>
                  <Select labelId="sort-select-label" label="Sort by" value={sort} onChange={handleSortChange} variant="outlined" size="small">
                    {sortOptions.map(l => (
                      <MenuItem key={l.id} value={l.id}>
                        <Typography variant="caption">{l.title}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            </div>

            <ProviderTable providers={currentPageProviders} sortOption={sort} />

            {search && currentPageProviders.length === 0 && (
              <div padding="1rem">
                <Typography>No provider found.</Typography>
              </div>
            )}

            {providers?.length > 0 && (
              <div padding="1rem 1rem 2rem">
                <CustomPagination pageSize={pageCount} setPageIndex={handleChangePage} pageIndex={page} size="medium" />
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
};
