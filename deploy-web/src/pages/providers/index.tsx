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
  Button
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import { makeStyles } from "tss-react/mui";
import { useSettings } from "@src/context/SettingsProvider";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useAkashProviders } from "@src/context/AkashProvider";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import Layout from "@src/components/layout/Layout";
import { useNetworkCapacity } from "@src/queries/useProvidersQuery";
import PageContainer from "@src/components/shared/PageContainer";
import { ProviderMap } from "@src/components/providers/ProviderMap";
import { ProviderList } from "@src/components/providers/ProviderList";
import { useSelectedNetwork } from "@src/utils/networks";
import dynamic from "next/dynamic";
import LaunchIcon from "@mui/icons-material/Launch";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";

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
  { id: 1, title: "Active Leases (desc)" },
  { id: 2, title: "Active Leases (asc)" },
  { id: 3, title: "Your Leases (desc)" },
  { id: 4, title: "Your Active Leases (desc)" }
];

const ProvidersPage: React.FunctionComponent<Props> = ({}) => {
  const { classes } = useStyles();
  const { address } = useKeplr();
  const [page, setPage] = useState(1);
  const [isFilteringActive, setIsFilteringActive] = useState(true);
  const [isFilteringFavorites, setIsFilteringFavorites] = useState(false);
  const [isFilteringAudited, setIsFilteringAudited] = useState(false);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState(1);
  const [search, setSearch] = useState("");
  const { settings } = useSettings();
  const { favoriteProviders } = useLocalNotes();
  const { apiEndpoint } = settings;
  const { providers, isLoadingProviders, getProviders } = useAkashProviders();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });
  const { data: networkCapacity, isFetching: isLoadingNetworkCapacity } = useNetworkCapacity();
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const currentPageProviders = filteredProviders.slice(start, end);
  const pageCount = Math.ceil(filteredProviders.length / rowsPerPage);
  const selectedNetwork = useSelectedNetwork();

  useEffect(() => {
    getLeases();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEndpoint]);

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
        filteredProviders = filteredProviders.filter(x => x.isActive);
      }

      if (isFilteringFavorites) {
        filteredProviders = filteredProviders.filter(x => favoriteProviders.some(y => y === x.owner));
      }

      if (isFilteringAudited) {
        filteredProviders = filteredProviders.filter(x => x.isAudited);
      }

      filteredProviders = filteredProviders.sort((a, b) => {
        if (sort === 1) {
          return b.leaseCount - a.leaseCount;
        } else if (sort === 2) {
          return a.leaseCount - b.leaseCount;
        } else if (sort === 3) {
          return b.userLeases - a.userLeases;
        } else if (sort === 4) {
          return b.userActiveLeases - a.userActiveLeases;
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

    setSort(value);
  };

  const handleRowsPerPageChange = event => {
    const value = event.target.value;

    setRowsPerPage(value);
  };

  return (
    <Layout isLoading={isLoadingProviders || isLoadingLeases || isLoadingNetworkCapacity}>
      <CustomNextSeo title="Providers" url={`https://deploy.cloudmos.io/providers`} description="Explore all the providers available on the Akash Network." />

      <PageContainer>
        <Typography variant="h1" className={classes.title} sx={{ marginBottom: ".2rem" }}>
          Network Capacity
        </Typography>

        {providers && providers.length > 0 && (
          <Typography variant="h3" sx={{ fontSize: "1rem", marginBottom: "2rem" }} color="textSecondary">
            {providers.filter(x => x.isActive).length} active providers on {selectedNetwork.title}
          </Typography>
        )}

        {isLoadingProviders && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem 0" }}>
            <CircularProgress size="4rem" color="secondary" />
          </Box>
        )}

        {providers && !isLoadingProviders && (
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
                onClick={() => window.open("https://akash.praetorapp.com/", "_blank")}
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
                      <MenuItem value={25}>
                        <Typography variant="caption">25</Typography>
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

              <ProviderList providers={currentPageProviders} />

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
