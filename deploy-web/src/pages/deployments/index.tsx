import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { useDeploymentList } from "@src/queries/useDeploymentQuery";
import { useEffect, useState } from "react";
import { useSettings } from "@src/context/SettingsProvider";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import { DeploymentListRow } from "@src/components/deployment/DeploymentListRow";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { LinkTo } from "@src/components/shared/LinkTo";
import LaunchIcon from "@mui/icons-material/Launch";
import PageContainer from "@src/components/shared/PageContainer";
import { useAkashProviders } from "@src/context/AkashProvider";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";
import { CustomTableHeader } from "@src/components/shared/CustomTable";

type Props = {};

const useStyles = makeStyles()(theme => ({
  root: {
    "& .MuiPagination-ul": {
      justifyContent: "center"
    }
  },
  titleContainer: {
    paddingBottom: "0.5rem",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap"
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: "bold"
  },
  createBtn: {
    marginLeft: "auto"
  }
}));

const DeploymentsPage: React.FunctionComponent<Props> = ({}) => {
  const { address, signAndBroadcastTx, isWalletLoaded } = useKeplr();
  const { providers } = useAkashProviders();
  const { data: deployments, isFetching: isLoadingDeployments, refetch: getDeployments } = useDeploymentList(address, { enabled: false });
  const [page, setPage] = useState(1);
  const { classes } = useStyles();
  const { settings, isSettingsInit } = useSettings();
  const [search, setSearch] = useState("");
  const { getDeploymentName } = useLocalNotes();
  const [filteredDeployments, setFilteredDeployments] = useState(null);
  const [isFilteringActive, setIsFilteringActive] = useState(true);
  const [selectedDeploymentDseqs, setSelectedDeploymentDseqs] = useState([]);
  const { apiEndpoint } = settings;
  const rowsPerPage = 10;
  const orderedDeployments = filteredDeployments ? [...filteredDeployments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) : [];
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const currentPageDeployments = orderedDeployments.slice(start, end);
  const pageCount = Math.ceil(orderedDeployments.length / rowsPerPage);
  const [deploySdl, setDeploySdl] = useAtom(sdlStore.deploySdl);

  useEffect(() => {
    if (isWalletLoaded && isSettingsInit) {
      getDeployments();
    }
  }, [isWalletLoaded, isSettingsInit, getDeployments, apiEndpoint, address]);

  useEffect(() => {
    if (deployments) {
      let filteredDeployments = deployments.map(d => {
        const name = getDeploymentName(d.dseq);

        return {
          ...d,
          name
        };
      });

      // Filter for search
      if (search) {
        filteredDeployments = filteredDeployments.filter(x => x.name?.toLowerCase().includes(search.toLowerCase()));
      }

      if (isFilteringActive) {
        filteredDeployments = filteredDeployments.filter(d => d.state === "active");
      }

      setFilteredDeployments(filteredDeployments);
    }
  }, [deployments, search, getDeploymentName, isFilteringActive]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const onIsFilteringActiveClick = (ev, value) => {
    setPage(1);
    setIsFilteringActive(value);
  };

  const onSearchChange = event => {
    const value = event.target.value;
    setSearch(value);
  };

  const onSelectDeployment = (checked, dseq) => {
    setSelectedDeploymentDseqs(prev => {
      return checked ? prev.concat([dseq]) : prev.filter(x => x !== dseq);
    });
  };

  const onCloseSelectedDeployments = async () => {
    try {
      const messages = selectedDeploymentDseqs.map(dseq => TransactionMessageData.getCloseDeploymentMsg(address, dseq));
      const response = await signAndBroadcastTx(messages);
      if (response) {
        getDeployments();
        setSelectedDeploymentDseqs([]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const onClearSelection = () => {
    setSelectedDeploymentDseqs([]);
  };

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  return (
    <Layout isLoading={isLoadingDeployments} isUsingSettings isUsingWallet>
      <NextSeo title="Deployments" />

      <PageContainer>
        <Box className={classes.root}>
          <Box className={classes.titleContainer}>
            <Typography variant="h3" className={classes.title}>
              Deployments
            </Typography>

            {deployments && (
              <>
                <Box marginLeft="1rem">
                  <IconButton aria-label="back" onClick={() => getDeployments()} size="small">
                    <RefreshIcon />
                  </IconButton>
                </Box>

                <Box marginLeft="2rem">
                  <FormControlLabel
                    control={<Checkbox checked={isFilteringActive} onChange={onIsFilteringActiveClick} color="secondary" size="small" />}
                    label="Active"
                  />
                </Box>

                {selectedDeploymentDseqs.length > 0 && (
                  <>
                    <Box sx={{ marginLeft: { xs: 0, sm: 0, md: "1rem" } }}>
                      <Button onClick={onCloseSelectedDeployments} color="secondary" variant="contained">
                        Close selected ({selectedDeploymentDseqs.length})
                      </Button>
                    </Box>

                    <Box marginLeft="1rem">
                      <LinkTo onClick={onClearSelection}>Clear</LinkTo>
                    </Box>
                  </>
                )}

                {filteredDeployments?.length > 0 && (
                  <Button
                    href={UrlService.newDeployment()}
                    component={Link}
                    className={classes.createBtn}
                    variant="contained"
                    size="medium"
                    color="secondary"
                    onClick={onDeployClick}
                  >
                    Deploy
                    <RocketLaunchIcon sx={{ marginLeft: "1rem" }} fontSize="small" />
                  </Button>
                )}
              </>
            )}
          </Box>

          {deployments?.length > 0 && (
            <Box padding=".5rem 0 1rem" display="flex" alignItems="center">
              <TextField
                label="Search Deployments by name"
                value={search}
                onChange={onSearchChange}
                type="text"
                variant="outlined"
                autoFocus
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
            </Box>
          )}

          {filteredDeployments?.length === 0 && !isLoadingDeployments && !search && (
            <Box textAlign="center" padding="4rem">
              <Typography variant="h5" sx={{ fontWeight: "normal" }}>
                {isFilteringActive ? "No active deployments" : "No deployments"}
              </Typography>

              <Button
                href={UrlService.newDeployment()}
                component={Link}
                variant="contained"
                size="large"
                color="secondary"
                sx={{ marginTop: "1rem" }}
                onClick={onDeployClick}
              >
                Deploy
                <RocketLaunchIcon sx={{ marginLeft: "1rem" }} fontSize="small" />
              </Button>
            </Box>
          )}

          {(!filteredDeployments || filteredDeployments?.length === 0) && isLoadingDeployments && (
            <Box sx={{ padding: "2rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CircularProgress size="4rem" color="secondary" />
            </Box>
          )}

          <Box>
            {orderedDeployments.length > 0 && (
              <Box className={classes.titleContainer} justifyContent="space-between">
                <Typography variant="caption">
                  You have {orderedDeployments.length}
                  {isFilteringActive ? " active" : ""} deployments
                </Typography>
              </Box>
            )}

            {currentPageDeployments?.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <CustomTableHeader>
                    <TableRow>
                      <TableCell width="10%" align="center">
                        Specs
                      </TableCell>
                      <TableCell width="20%" align="center">
                        Name
                      </TableCell>
                      <TableCell width="10%" align="center">
                        Time left
                      </TableCell>
                      <TableCell align="center" width="10%">
                        Balance
                      </TableCell>
                      <TableCell align="center" width="10%">
                        Cost
                      </TableCell>
                      <TableCell align="center" width="20%">
                        Leases
                      </TableCell>
                      <TableCell align="center" width="20%"></TableCell>
                    </TableRow>
                  </CustomTableHeader>

                  <TableBody>
                    {currentPageDeployments.map(deployment => (
                      <DeploymentListRow
                        key={deployment.dseq}
                        deployment={deployment}
                        refreshDeployments={getDeployments}
                        providers={providers}
                        isSelectable
                        onSelectDeployment={onSelectDeployment}
                        checked={selectedDeploymentDseqs.some(x => x === deployment.dseq)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {search && currentPageDeployments.length === 0 && (
            <Box padding="1rem 0">
              <Typography>No deployment found.</Typography>
            </Box>
          )}

          {filteredDeployments?.length > 0 && (
            <Box padding="1rem 0 2rem">
              <Pagination count={pageCount} onChange={handleChangePage} page={page} size="medium" />
            </Box>
          )}
        </Box>
      </PageContainer>
    </Layout>
  );
};

export default DeploymentsPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
