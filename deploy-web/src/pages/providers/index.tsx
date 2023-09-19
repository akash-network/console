import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  IconButton,
  FormControlLabel,
  Checkbox,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Pagination,
  CircularProgress,
  Button,
  useTheme
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import { makeStyles } from "tss-react/mui";
import { useSettings } from "@src/context/SettingsProvider";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import Layout from "@src/components/layout/Layout";
import { useNetworkCapacity, useProviderList } from "@src/queries/useProvidersQuery";
import PageContainer from "@src/components/shared/PageContainer";
import { ProviderMap } from "@src/components/providers/ProviderMap";
import { ProviderList } from "@src/components/providers/ProviderList";
import dynamic from "next/dynamic";
import LaunchIcon from "@mui/icons-material/Launch";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService } from "@src/utils/urlUtils";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { ClientProviderList } from "@src/types/provider";
import { useRouter } from "next/router";

const NetworkCapacity = dynamic(() => import("../../components/providers/NetworkCapacity"), {
  ssr: false
});

type Props = {};

const useStyles = makeStyles()(theme => ({
  root: {
    "& .MuiPagination-ul": {
      justifyContent: "center"
    }
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: "bold"
  },
  checkbox: {
    padding: "4px"
  },
  selectFormControl: {
    flexBasis: "250px",
    marginLeft: "1rem"
  }
}));

const sortOptions = [
  { id: "active-leases-desc", title: "Active Leases (desc)" },
  { id: "active-leases-asc", title: "Active Leases (asc)" },
  { id: "my-leases-desc", title: "Your Leases (desc)" },
  { id: "my-active-leases-desc", title: "Your Active Leases (desc)" },
  { id: "gpu-available-desc", title: "GPUs Available (desc)" }
];

const ProvidersPage: React.FunctionComponent<Props> = ({}) => {
  const { classes } = useStyles();
  const { address } = useKeplr();
  const [page, setPage] = useState(1);
  const [isFilteringActive, setIsFilteringActive] = useState(true);
  const [isFilteringFavorites, setIsFilteringFavorites] = useState(false);
  const [isFilteringAudited, setIsFilteringAudited] = useState(false);
  const [filteredProviders, setFilteredProviders] = useState<Array<ClientProviderList>>([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState<string>("active-leases-desc");
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
  const theme = useTheme();

  useEffect(() => {
    getLeases();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEndpoint]);

  useEffect(() => {
    const querySort = router.query.sort as string;

    if (querySort && sortOptions.some(x => x.id === querySort)) {
      setSort(querySort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query]);

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

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const onIsFilteringActiveClick = (ev, value) => {
    setPage(1);
    setIsFilteringActive(value);
  };

  const onIsFilteringFavoritesClick = (ev, value) => {
    setPage(1);
    setIsFilteringFavorites(value);
  };

  const onIsFilteringAuditedClick = (ev, value) => {
    setPage(1);
    setIsFilteringAudited(value);
  };

  const onSearchChange = event => {
    const value = event.target.value;
    setSearch(value);
  };

  const handleSortChange = event => {
    const value = event.target.value;

    router.replace(UrlService.providers(value));
  };

  const handleRowsPerPageChange = event => {
    const value = event.target.value;

    setRowsPerPage(value);
  };

  return (
    <Layout isLoading={isLoadingProviders || isLoadingLeases || isLoadingNetworkCapacity}>
      <CustomNextSeo
        title="Providers"
        url={`https://deploy.cloudmos.io${UrlService.providers()}`}
        description="Explore all the providers available on the Akash Network."
      />

      <PageContainer>
        <Typography variant="h1" className={classes.title} sx={{ marginBottom: ".2rem" }}>
          Network Capacity
        </Typography>

        {providers && providers.length > 0 && (
          <Typography variant="h3" sx={{ fontSize: "1rem", marginBottom: "2rem" }} color="textSecondary">
            <Box component="span" sx={{ color: theme.palette.secondary.main, fontWeight: "bold", fontSize: "1.25rem" }}>
              {providers.filter(x => x.isOnline).length}
            </Box>{" "}
            active providers on {selectedNetwork.title}
          </Typography>
        )}

        {!providers && isLoadingProviders && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem 0" }}>
            <CircularProgress size="4rem" color="secondary" />
          </Box>
        )}

        {providers && (
          <Box sx={{ maxWidth: "800px", margin: "0 auto" }}>
            <ProviderMap providers={providers} />
          </Box>
        )}

        {providers && networkCapacity && (
          <Box sx={{ marginBottom: "2rem" }}>
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
          </Box>
        )}

        {providers?.length > 0 && (
          <>
            <Box sx={{ margin: "1rem 0" }}>
              <Button
                onClick={() => window.open("https://docs.akash.network/providers", "_blank")}
                size="large"
                color="secondary"
                variant="contained"
                endIcon={<LaunchIcon fontSize="small" />}
              >
                Become a provider
              </Button>
            </Box>

            <Box className={classes.root}>
              <Box sx={{ display: "flex", alignItems: "center", padding: "1rem 0 0", flexWrap: "wrap" }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Typography variant="h3" className={classes.title}>
                    Providers
                  </Typography>

                  <Box marginLeft="1rem">
                    <IconButton aria-label="back" onClick={() => refresh()} size="small">
                      <RefreshIcon />
                    </IconButton>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", marginLeft: { xs: 0, sm: 0, md: "2rem" } }}>
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isFilteringActive}
                          onChange={onIsFilteringActiveClick}
                          color="secondary"
                          size="small"
                          classes={{ root: classes.checkbox }}
                        />
                      }
                      label="Active"
                    />
                  </Box>
                  <Box marginLeft="1rem">
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
                  </Box>
                  <Box marginLeft="1rem">
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
                  </Box>
                </Box>
              </Box>

              <Box sx={{ padding: "1rem 0", display: "flex", alignItems: "center", flexDirection: { xs: "column", sm: "column", md: "row" } }}>
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

                <Box
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
                </Box>
              </Box>

              <ProviderList providers={currentPageProviders} sortOption={sort} />

              {search && currentPageProviders.length === 0 && (
                <Box padding="1rem">
                  <Typography>No provider found.</Typography>
                </Box>
              )}

              {providers?.length > 0 && (
                <Box padding="1rem 1rem 2rem">
                  <Pagination count={pageCount} onChange={handleChangePage} page={page} size="medium" />
                </Box>
              )}
            </Box>
          </>
        )}
      </PageContainer>
    </Layout>
  );
};

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}

export default ProvidersPage;
