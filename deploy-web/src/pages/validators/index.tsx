import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useTheme } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import CircularProgress from "@mui/material/CircularProgress";
import { useValidators } from "@src/queries/useValidatorsQuery";
import { NextSeo } from "next-seo";
import { Title } from "@src/components/shared/Title";
import { BASE_API_URL, validatorAddress } from "@src/utils/constants";
import { CustomTableHeader } from "@src/components/shared/CustomTable";
import { useEffect, useState } from "react";
import { useWallet } from "@src/context/WalletProvider";
import axios from "axios";
import { AddressDetail } from "@src/types";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import { Button, TableSortLabel } from "@mui/material";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { ValidatorRow } from "@src/components/validator/ValidatorRow";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";

type Props = {
  errors?: string;
};

const useStyles = makeStyles()(theme => ({}));

const ValidatorsPage: React.FunctionComponent<Props> = ({}) => {
  const [sortingColumn, setSortingColumn] = useState("rank");
  const [isSortingReversed, setIsSortingReversed] = useState(false);
  const [walletAddressData, setWalletAddressData] = useState<AddressDetail>(null);
  const { classes } = useStyles();
  const theme = useTheme();
  const { data: validators, isLoading } = useValidators();
  const { address, signAndBroadcastTx } = useWallet();

  useEffect(() => {
    setWalletAddressData(null);
    if (address) {
      loadDelegations();
    } else if (sortingColumn === "reward") {
      setSortingColumn("rank");
      setIsSortingReversed(false);
    }
  }, [address]);

  async function onClaimAllClick() {
    await signAndBroadcastTx(
      walletAddressData.delegations
        .filter(x => x.reward > 0)
        .map(x => x.validator.operatorAddress)
        .map(validator => ({
          typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
          value: MsgWithdrawDelegatorReward.fromJSON({
            delegatorAddress: address,
            validatorAddress: validator
          })
        }))
    );

    await loadDelegations();

    event(AnalyticsEvents.VALIDATORS_CLAIM_ALL_REWARDS, {
      category: "validators",
      label: "Claim all rewards"
    });
  }

  async function loadDelegations() {
    const response = await axios.get(`${BASE_API_URL}/addresses/${address}`);
    setWalletAddressData(response.data);
  }

  const handleRequestSort = (column: string) => {
    if (sortingColumn === column) {
      setIsSortingReversed(!isSortingReversed);
    } else {
      setSortingColumn(column);
      setIsSortingReversed(false);
    }
  };

  const validatorsWithRewards = validators?.map(v => ({
    ...v,
    reward: walletAddressData?.delegations.find(x => x.validator.operatorAddress === v.operatorAddress)?.reward,
    delegatedAmount: walletAddressData?.delegations.find(x => x.validator.operatorAddress === v.operatorAddress)?.amount
  }));
  const sortedValidators = validatorsWithRewards?.sort((a, b) => ((a[sortingColumn] || 0) > (b[sortingColumn] || 0) ? 1 : -1));
  if (isSortingReversed) {
    sortedValidators?.reverse();
  }

  const cloudmos = validatorsWithRewards?.find(v => v.operatorAddress === validatorAddress);

  return (
    <Layout>
      <NextSeo title="Validators" />

      <PageContainer>
        <Title value="Validators" />

        {walletAddressData && (
          <Box sx={{ paddingBottom: 1 }}>
            Rewards: <AKTAmount uakt={walletAddressData.rewards} showAKTLabel showUSD />
            &nbsp;
            <Button
              variant="outlined"
              size="small"
              color="secondary"
              sx={{ marginLeft: "1rem" }}
              disabled={walletAddressData.rewards === 0}
              onClick={onClaimAllClick}
            >
              Claim All
            </Button>
          </Box>
        )}

        <Paper sx={{ padding: 2 }}>
          {isLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
              <CircularProgress color="secondary" />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <CustomTableHeader>
                  <TableRow>
                    <TableCell width="5%">
                      <TableSortLabel
                        active={sortingColumn === "rank"}
                        direction={isSortingReversed ? "desc" : "asc"}
                        onClick={() => handleRequestSort("rank")}
                      >
                        Rank
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortingColumn === "moniker"}
                        direction={isSortingReversed ? "desc" : "asc"}
                        onClick={() => handleRequestSort("moniker")}
                      >
                        Validator
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortingColumn === "votingPower"}
                        direction={isSortingReversed ? "desc" : "asc"}
                        onClick={() => handleRequestSort("votingPower")}
                      >
                        Voting Power
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">
                      <TableSortLabel
                        active={sortingColumn === "commission"}
                        direction={isSortingReversed ? "desc" : "asc"}
                        onClick={() => handleRequestSort("commission")}
                      >
                        Commission
                      </TableSortLabel>
                    </TableCell>
                    {walletAddressData && (
                      <>
                        <TableCell align="center">
                          <TableSortLabel
                            active={sortingColumn === "delegatedAmount"}
                            direction={isSortingReversed ? "desc" : "asc"}
                            onClick={() => handleRequestSort("delegatedAmount")}
                          >
                            Delegated Amount
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">
                          <TableSortLabel
                            active={sortingColumn === "reward"}
                            direction={isSortingReversed ? "desc" : "asc"}
                            onClick={() => handleRequestSort("reward")}
                          >
                            Rewards
                          </TableSortLabel>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                </CustomTableHeader>

                <TableBody>
                  {sortingColumn === "rank" && <ValidatorRow validator={cloudmos} reward={cloudmos.reward} delegatedAmount={cloudmos.delegatedAmount} />}

                  {sortedValidators?.map(validator => {
                    return (
                      <ValidatorRow
                        key={validator.operatorAddress}
                        validator={validator}
                        reward={validator.reward}
                        delegatedAmount={validator.delegatedAmount}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </PageContainer>
    </Layout>
  );
};

export default ValidatorsPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}

