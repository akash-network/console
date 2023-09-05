import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Fade,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography
} from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { FormattedNumber } from "react-intl";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import { GradientText } from "@src/components/shared/GradientText";
import { NextSeo } from "next-seo";
import { BASE_API_URL } from "@src/utils/constants";
import { bibyteUnits, bytesToShrink, toBytes } from "@src/utils/unitUtils";
import axios from "axios";
import PriceCompareAmount from "@src/components/shared/PriceCompareNumber";
import { LeaseSpecDetail } from "@src/components/shared/LeaseSpecDetail";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { CustomTableHeader, CustomTableRow } from "@src/components/shared/CustomTable";
import debounce from "lodash/debounce";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";

const selectableUnits = ["MB", "GB", "MiB", "GiB"];

const useStyles = makeStyles()(theme => ({
  root: {
    paddingBottom: 100
  },
  table: {
    minWidth: 650
  },
  titleContainer: {
    textAlign: "center",
    marginBottom: "2rem"
  },
  pageTitle: {
    fontSize: "3rem",
    fontWeight: "bold"
  },
  dataCell: {
    verticalAlign: "initial",
    borderBottom: "none"
  },
  tableRow: {
    "&:last-child td": {
      paddingBottom: 20
    }
  },
  disclaimerRow: {
    marginTop: 50
  },
  disclaimerTitle: {
    fontWeight: "bold",
    marginBottom: "1rem"
  },
  disclaimerList: {
    textDecoration: "none"
  },
  link: {
    fontWeight: "bold",
    textDecoration: "underline"
  },
  otherCloud: {
    color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[600]
  }
}));

interface IPriceCompareProps {}

export const PriceCompare: React.FunctionComponent<IPriceCompareProps> = ({}) => {
  const {
    push,
    query: { cpu, memory, storage, memoryUnit, storageUnit }
  } = useRouter();
  const { classes } = useStyles();
  const [basicPricing, setBasicPricing] = useState<any>([]);
  const [selectedCPU, setSelectedCPU] = useState<number>(1);
  const [selectedMemory, setSelectedMemory] = useState<number>(1);
  const [selectedStorage, setSelectedStorage] = useState<number>(1);
  const [selectedMemoryUnit, setSelectedMemoryUnit] = useState<string>("GB");
  const [selectedStorageUnit, setSelectedStorageUnit] = useState<string>("GB");
  const [customPricing, setCustomPricing] = useState<any>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState<any>(false);
  const customPriceAvg = customPricing ? roundDecimal((customPricing.aws + customPricing.gcp + customPricing.azure) / 3, 2) : null;

  const specs = [
    { cpu: 1000, memory: 1000000000, storage: 1000000000 },
    { cpu: 1000, memory: 2000000000, storage: 1000000000 },
    { cpu: 2000, memory: 4000000000, storage: 1000000000 },
    { cpu: 2000, memory: 8000000000, storage: 1000000000 },
    { cpu: 2000, memory: 16000000000, storage: 1000000000 }
  ];

  useEffect(() => {
    (async () => {
      setIsLoadingPricing(true);
      const response = await axios.post(BASE_API_URL + "/pricing", specs);

      setBasicPricing(response.data);
      setIsLoadingPricing(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoadingPricing(true);

      const isMemBibyte = bibyteUnits.some(x => x === memoryUnit);
      const isStorageBibyte = bibyteUnits.some(x => x === storageUnit);

      const _memoryUnit = memoryUnit ? (selectableUnits.some(u => u === (memoryUnit as string)) ? (memoryUnit as string) : "GB") : selectedMemoryUnit;
      const _storageUnit = storageUnit ? (selectableUnits.some(u => u === (storageUnit as string)) ? (storageUnit as string) : "GB") : selectedStorageUnit;
      const _cpu = cpu ? parseFloat(cpu as string) : selectedCPU;
      const _memory = memory ? parseFloat(memory as string) : selectedMemory;
      const _storage = storage ? parseFloat(storage as string) : selectedStorage;

      setSelectedCPU(_cpu);
      setSelectedMemory(_memory);
      setSelectedMemoryUnit(_memoryUnit);
      setSelectedStorage(_storage);
      setSelectedStorageUnit(_storageUnit);

      const response = await axios.post(BASE_API_URL + "/pricing", {
        cpu: _cpu * 1000,
        memory: toBytes(_memory, _memoryUnit, isMemBibyte),
        storage: toBytes(_storage, _storageUnit, isStorageBibyte)
      });

      setCustomPricing(response.data);
      setIsLoadingPricing(false);
    })();
  }, [cpu, memory, storage, memoryUnit, storageUnit]);

  const handleDebounceFn = (cpu: number, memory: number, storage: number, memoryUnit: string, storageUnit: string) => {
    push(UrlService.priceCompareCustom(cpu, memory, storage, memoryUnit, storageUnit), undefined, { scroll: false });
  };
  const debounceRouteChange = useCallback(debounce(handleDebounceFn, 1000), []);

  const handleCPUChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setSelectedCPU(isNaN(value) ? ("" as any) : value);

    if (value) {
      debounceRouteChange(value, selectedMemory, selectedStorage, selectedMemoryUnit, selectedStorageUnit);
    }
  };

  const handleMemoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setSelectedMemory(isNaN(value) ? ("" as any) : value);

    if (value) {
      debounceRouteChange(selectedCPU, value, selectedStorage, selectedMemoryUnit, selectedStorageUnit);
    }
  };

  const handleMemoryUnitChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    setSelectedMemoryUnit(value);

    debounceRouteChange(selectedCPU, selectedMemory, selectedStorage, value, selectedStorageUnit);
  };

  const handleStorageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setSelectedStorage(isNaN(value) ? ("" as any) : value);

    if (value) {
      debounceRouteChange(selectedCPU, selectedMemory, value, selectedMemoryUnit, selectedStorageUnit);
    }
  };

  const handleStorageUnitChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    setSelectedStorageUnit(value);

    debounceRouteChange(selectedCPU, selectedMemory, selectedStorage, selectedMemoryUnit, value);
  };

  return (
    <Layout isLoading={isLoadingPricing}>
      <CustomNextSeo
        title="Price comparision"
        url={`https://deploy.cloudmos.io${UrlService.priceCompare()}`}
        description="Compare Akash cost savings against the cloud giants like Amazon Web Services (aws), Google Cloud Platform (gcp) and Microsoft Azure."
      />

      <PageContainer>
        <div className={classes.titleContainer}>
          <Typography variant="h1" className={classes.pageTitle}>
            <GradientText>Akash vs. Cloud giants</GradientText>
          </Typography>
          <Typography variant="h5">A simple price comparison</Typography>
          <Typography variant="caption">$USD price per month</Typography>
        </div>

        <div>
          <TableContainer component={Paper} sx={{ marginTop: 2 }}>
            <Fade
              in={isLoadingPricing}
              style={{
                transitionDelay: isLoadingPricing ? "300ms" : "0ms"
              }}
            >
              <LinearProgress color="secondary" />
            </Fade>
            <Table className={classes.table} aria-label="price comparisons">
              <CustomTableHeader>
                <TableRow>
                  <TableCell align="center" width="40%">
                    Specs
                  </TableCell>
                  <TableCell align="center" width="30%">
                    <GradientText>
                      <Box component="span" sx={{ fontWeight: "bold", fontSize: "1.2rem" }}>
                        Akash
                      </Box>
                    </GradientText>
                  </TableCell>
                  <TableCell align="center" width="10%">
                    AWS
                  </TableCell>
                  <TableCell align="center" width="10%">
                    GCP
                  </TableCell>
                  <TableCell align="center" width="10%">
                    Azure
                  </TableCell>
                </TableRow>
              </CustomTableHeader>
              <TableBody>
                <TableRow>
                  <TableCell align="center" component="th" scope="row">
                    <Box sx={{ display: "inline-flex", alignItems: "center", margin: "0 auto" }}>
                      <div>
                        <FormControl sx={{ marginRight: 1, width: "5rem" }} variant="outlined">
                          <InputLabel htmlFor="vcpu-input">vCPUs</InputLabel>
                          <OutlinedInput
                            id="vcpu-input"
                            label="vCPUs"
                            type="number"
                            value={selectedCPU}
                            onChange={handleCPUChange}
                            size="small"
                            inputProps={{
                              min: 0.1,
                              step: 0.1
                            }}
                          />
                        </FormControl>
                      </div>

                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <FormControl variant="outlined" sx={{ width: "5rem" }}>
                          <InputLabel htmlFor="memory-input">Memory</InputLabel>
                          <OutlinedInput
                            id="memory-input"
                            type="number"
                            label="Memory"
                            value={selectedMemory}
                            onChange={handleMemoryChange}
                            size="small"
                            inputProps={{
                              min: 1
                            }}
                          />
                        </FormControl>
                        <Select
                          value={selectedMemoryUnit}
                          onChange={handleMemoryUnitChange}
                          size="small"
                          sx={{ width: "5rem" }}
                          MenuProps={{ disableScrollLock: true }}
                        >
                          {selectableUnits.map(u => (
                            <MenuItem key={u} value={u}>
                              {u}
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", marginLeft: 1 }}>
                        <FormControl variant="outlined" sx={{ width: "5rem" }}>
                          <InputLabel htmlFor="storage-input">Storage</InputLabel>
                          <OutlinedInput
                            id="storage-input"
                            label="Storage"
                            type="number"
                            value={selectedStorage}
                            onChange={handleStorageChange}
                            size="small"
                            inputProps={{
                              min: 1
                            }}
                          />
                        </FormControl>

                        <Select
                          value={selectedStorageUnit}
                          onChange={handleStorageUnitChange}
                          size="small"
                          sx={{ width: "5rem" }}
                          MenuProps={{ disableScrollLock: true }}
                        >
                          {selectableUnits.map(u => (
                            <MenuItem key={u} value={u}>
                              {u}
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center" component="th" scope="row" sx={{ fontSize: "1.25rem", fontWeight: "bold", whiteSpace: "nowrap" }}>
                    {customPricing && <PriceCompareAmount amount={customPricing.akash} compareAmount={customPriceAvg} />}
                  </TableCell>
                  <TableCell align="center" component="th" scope="row" className={classes.otherCloud}>
                    {customPricing && <FormattedNumber style="currency" currency="USD" value={customPricing.aws} />}
                  </TableCell>
                  <TableCell align="center" component="th" scope="row" className={classes.otherCloud}>
                    {customPricing && <FormattedNumber style="currency" currency="USD" value={customPricing.gcp} />}
                  </TableCell>
                  <TableCell align="center" component="th" scope="row" className={classes.otherCloud}>
                    {customPricing && <FormattedNumber style="currency" currency="USD" value={customPricing.azure} />}
                  </TableCell>
                </TableRow>
                {specs.map((spec, i) => {
                  const pricing = basicPricing.find(x => x.spec.cpu === spec.cpu && x.spec.memory === spec.memory && x.spec.storage === spec.storage);
                  const priceAvg = pricing ? roundDecimal((pricing.aws + pricing.gcp + pricing.azure) / 3, 2) : null;
                  const _ram = bytesToShrink(spec.memory);
                  const _storage = bytesToShrink(spec.storage);

                  return (
                    <CustomTableRow key={i} className={classes.tableRow}>
                      <TableCell align="center" component="th" scope="row">
                        <Box sx={{ display: "inline-flex", alignItems: "center" }}>
                          <LeaseSpecDetail type="cpu" value={spec.cpu / 1_000} />
                          <LeaseSpecDetail type="ram" value={`${roundDecimal(_ram.value, 1)} ${_ram.unit}`} sx={{ marginLeft: "1rem" }} />
                          <LeaseSpecDetail type="storage" value={`${roundDecimal(_storage.value, 1)} ${_storage.unit}`} sx={{ marginLeft: "1rem" }} />
                        </Box>
                      </TableCell>
                      <TableCell align="center" component="th" scope="row" sx={{ fontSize: "1.25rem", fontWeight: "bold" }}>
                        {pricing && <PriceCompareAmount amount={pricing.akash} compareAmount={priceAvg} />}
                      </TableCell>
                      <TableCell align="center" component="th" scope="row" className={classes.otherCloud}>
                        {pricing && <FormattedNumber style="currency" currency="USD" value={pricing.aws} />}
                      </TableCell>
                      <TableCell align="center" component="th" scope="row" className={classes.otherCloud}>
                        {pricing && <FormattedNumber style="currency" currency="USD" value={pricing.gcp} />}
                      </TableCell>
                      <TableCell align="center" component="th" scope="row" className={classes.otherCloud}>
                        {pricing && <FormattedNumber style="currency" currency="USD" value={pricing.azure} />}
                      </TableCell>
                    </CustomTableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </div>

        <div className={classes.disclaimerRow}>
          <Typography variant="h4" className={classes.disclaimerTitle}>
            Disclaimer
          </Typography>

          <u className={classes.disclaimerList}>
            <li>These prices may vary. We strongly suggest that you do your own research as we may have miss-calculated some of the providers pricing.</li>
            <li>
              To calculate the pricing for Akash, we use the same calculations from the provider bidding engine in the{" "}
              <a
                href="https://github.com/akash-network/helm-charts/blob/main/charts/akash-provider/scripts/price_script_generic.sh"
                target="_blank"
                rel="noopener"
              >
                helm-charts
              </a>{" "}
              repo from Akash.
            </li>
            <li>For the other cloud providers, we use the same logic of price per GB of ram/storage and price per thread.</li>
            <li>
              <a href="https://aws.amazon.com/fargate/pricing/" target="_blank" rel="noopener" className={classes.link}>
                Amazon Web Service pricing calculator
              </a>
            </li>
            <li>
              <a href="https://cloud.google.com/kubernetes-engine/pricing" target="_blank" rel="noopener" className={classes.link}>
                Google cloud platform pricing calculator
              </a>
            </li>
            <li>
              <a href="https://azure.microsoft.com/en-ca/pricing/details/container-instances/" target="_blank" rel="noopener" className={classes.link}>
                Microsoft Azure pricing calculator
              </a>
            </li>
          </u>
        </div>
      </PageContainer>
    </Layout>
  );
};

export default PriceCompare;
