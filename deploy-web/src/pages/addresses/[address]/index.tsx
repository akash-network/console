import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useTheme } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import { BASE_API_MAINNET_URL, BASE_API_TESTNET_URL } from "@src/utils/constants";
import axios from "axios";
import TableContainer from "@mui/material/TableContainer";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Table from "@mui/material/Table";
import { AddressDetail } from "@src/types/address";
import { GradientText } from "@src/components/shared/GradientText";
import { useQRCode } from "next-qrcode";
import { Address } from "@src/components/shared/Address";
import { useState } from "react";
import { Avatar, Button, Grid, IconButton, Tab, Tabs, Tooltip } from "@mui/material";
import { a11yTabProps } from "@src/utils/a11y";
import { Delegations } from "@src/components/address/Delegations";
import { Redelegations } from "@src/components/address/Redelegations";
import { FormattedDecimal } from "@src/components/shared/FormattedDecimal";
import { LabelValue } from "@src/components/shared/LabelValue";
import { Title } from "@src/components/shared/Title";
import { NextSeo } from "next-seo";
import HelpIcon from "@mui/icons-material/Help";
import { getSplitText } from "@src/hooks/useShortText";
import QrCodeIcon from "@mui/icons-material/QrCode";
import MoneyOffIcon from "@mui/icons-material/MoneyOff";
import SendIcon from "@mui/icons-material/Send";
import { CustomTableHeader, CustomTableRow } from "@src/components/shared/CustomTable";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { useUser } from "@auth0/nextjs-auth0";
import { SendAktModal } from "@src/components/address/SendAktModal";
import { MustConnectModal } from "@src/components/shared/MustConnectModal";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useAddressBook } from "@src/context/AddressBookProvider";
import AddressLayout from "@src/components/address/AddressLayout";
import { TransactionRow } from "@src/components/blockchain/TransactionRow";

type Props = {
  address: string;
  addressDetail: AddressDetail;
};

const useStyles = makeStyles()(theme => ({
  tooltip: {
    fontSize: ".8rem",
    whiteSpace: "nowrap",
    maxWidth: "none"
  },
  qrTooltip: {
    padding: ".25rem .35rem"
  }
}));

const AddressDetailPage: React.FunctionComponent<Props> = ({ address, addressDetail }) => {
  const { addressNames, editAddressName } = useAddressBook();
  const [showMustConnectModal, setShowMustConnectModal] = useState<string>(null);
  const [assetTab, setAssetTab] = useState("delegations");
  const [isShowingSendModal, setIsShowingSendModal] = useState<boolean>(false);
  const { user } = useUser();
  const { classes } = useStyles();
  const { Canvas } = useQRCode();
  const theme = useTheme();

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setAssetTab(newValue);
  };

  const QRcode = (
    <Canvas
      text={address}
      options={{
        type: "image/jpeg",
        quality: 0.3,
        level: "M",
        margin: 2,
        scale: 4,
        width: 175,
        color: {
          dark: theme.palette.secondary.main,
          light: theme.palette.primary.main
        }
      }}
    />
  );

  async function onSendClick() {
    setIsShowingSendModal(true);

    event(AnalyticsEvents.ADDRESSES_SEND_TOKENS_CLICK, {
      category: "addresses",
      label: "Click to send tokens"
    });
  }

  return (
    <Layout>
      <NextSeo title={`Account ${address}`} />
      <SendAktModal onClose={() => setIsShowingSendModal(false)} open={isShowingSendModal} toAddress={address} />
      {showMustConnectModal && <MustConnectModal message={showMustConnectModal} onClose={() => setShowMustConnectModal(null)} />}

      <AddressLayout page="address" address={address}>
        <Paper sx={{ padding: 2 }} elevation={2}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              [theme.breakpoints.down("sm")]: {
                flexDirection: "column",
                alignItems: "flex-start"
              }
            }}
          >
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              {QRcode}
              <Box sx={{ textAlign: "center", paddingTop: 1 }}>
                <Button variant="outlined" color="secondary" onClick={onSendClick}>
                  <SendIcon />
                  &nbsp; Send AKT
                </Button>
              </Box>
            </Box>
            <Box sx={{ display: { xs: "block", sm: "none" } }}>
              <Tooltip arrow title={QRcode} enterTouchDelay={0} leaveTouchDelay={10000} classes={{ tooltip: classes.qrTooltip }}>
                <QrCodeIcon />
              </Tooltip>
            </Box>

            <Box sx={{ paddingLeft: { xs: 0, sm: "1rem" }, paddingTop: { xs: ".5rem" }, flexGrow: 1 }}>
              <LabelValue
                label="Address"
                value={
                  <Box sx={{ color: theme.palette.secondary.main, display: "flex", alignItems: "center" }}>
                    <Address address={address} addressBookMode="alongside" isCopyable disableTruncate />

                    <CustomTooltip arrow title="Address book">
                      <IconButton
                        onClick={() => (user ? editAddressName(address) : setShowMustConnectModal("To add an address to your address book"))}
                        size="small"
                        sx={{ marginLeft: ".5rem" }}
                      >
                        {address in addressNames ? <BookmarkIcon /> : <BookmarkAddIcon />}
                      </IconButton>
                    </CustomTooltip>

                    {/** TODO Alerts */}
                    {/* <AddressAlertCreateButtonLink sx={{ marginLeft: ".5rem" }} address={address} /> */}
                  </Box>
                }
                labelWidth="10rem"
              />

              <Box
                sx={{
                  marginBottom: "1rem",
                  paddingBottom: ".5rem",
                  borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}`,
                  fontSize: "1.5rem"
                }}
              >
                <LabelValue
                  label={
                    <GradientText>
                      <strong>AKT</strong>
                    </GradientText>
                  }
                  value={<AKTAmount uakt={addressDetail.total} showUSD />}
                  labelWidth="10rem"
                />
              </Box>

              <LabelValue label="Available" value={<AKTAmount uakt={addressDetail.available} showUSD />} labelWidth="10rem" />
              <LabelValue label="Delegated" value={<AKTAmount uakt={addressDetail.delegated} showUSD />} labelWidth="10rem" />
              <LabelValue label="Rewards" value={<AKTAmount uakt={addressDetail.rewards} showUSD />} labelWidth="10rem" />
              <LabelValue label="Commission" value={<AKTAmount uakt={addressDetail.commission} showUSD />} labelWidth="10rem" />
            </Box>
          </Box>
        </Paper>

        <Box sx={{ mt: "1rem" }}>
          <Title value="Assets" subTitle sx={{ marginBottom: "1rem" }} />

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ padding: 2, height: "100%" }} elevation={2}>
                <TableContainer>
                  <Table size="small">
                    <CustomTableHeader>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell align="center">Amount</TableCell>
                      </TableRow>
                    </CustomTableHeader>

                    <TableBody>
                      {addressDetail.assets.map(asset => (
                        <CustomTableRow key={asset.symbol || asset.ibcToken}>
                          <TableCell>
                            <Box style={{ display: "flex", alignItems: "center" }}>
                              <Box mr={1}>
                                <Avatar src={asset.logoUrl} sx={{ width: "26px", height: "26px" }}>
                                  {!asset.logoUrl && <MoneyOffIcon />}
                                </Avatar>
                              </Box>
                              <div>
                                <div style={{ display: "flex", alignItems: "center" }}>
                                  {asset.symbol || "Unknown"}
                                  {asset.description && (
                                    <CustomTooltip arrow title={asset.description}>
                                      <HelpIcon style={{ marginLeft: "4px", fontSize: "15px" }} />
                                    </CustomTooltip>
                                  )}
                                </div>
                                {asset.ibcToken && (
                                  <div>
                                    <CustomTooltip arrow title={asset.ibcToken}>
                                      <small>{getSplitText(asset.ibcToken, 10, 10)}</small>
                                    </CustomTooltip>
                                  </div>
                                )}
                              </div>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <FormattedDecimal value={asset.amount} />
                          </TableCell>
                        </CustomTableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Paper sx={{ padding: 2, height: "100%" }} elevation={2}>
                <Box sx={{ borderBottom: 1, borderColor: "divider", marginBottom: 1 }}>
                  <Tabs
                    value={assetTab}
                    onChange={handleTabChange}
                    aria-label="assets table"
                    textColor="secondary"
                    indicatorColor="secondary"
                    variant="scrollable"
                    scrollButtons="auto"
                  >
                    <Tab value="delegations" label="Delegations" {...a11yTabProps("delegation-tab", "delegation-tab-panel", 0)} />
                    <Tab value="redelegations" label="Redelegations" {...a11yTabProps("redelegations-tab", "redelegations-tab-panel", 1)} />
                  </Tabs>
                </Box>

                {assetTab === "delegations" && <Delegations delegations={addressDetail.delegations} />}
                {assetTab === "redelegations" && <Redelegations redelegations={addressDetail.redelegations} />}
              </Paper>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mt: "1rem" }}>
          <Title value="Latest Transactions" subTitle sx={{ marginBottom: "1rem" }} />

          <Paper sx={{ padding: 2, height: "100%" }} elevation={2}>
            {addressDetail.latestTransactions?.length === 0 ? (
              <Box sx={{ padding: "1rem", display: "flex", alignItems: "center" }}>
                <SearchOffIcon />
                &nbsp;This address has no transactions
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <CustomTableHeader>
                    <TableRow>
                      <TableCell width="10%">Tx Hash</TableCell>
                      <TableCell align="center" width="20%">
                        Type
                      </TableCell>
                      <TableCell align="center" width="10%">
                        Result
                      </TableCell>
                      <TableCell align="center" width="10%">
                        Amount
                      </TableCell>
                      <TableCell align="center" width="10%">
                        Fee
                      </TableCell>
                      <TableCell align="center" width="5%">
                        Height
                      </TableCell>
                      <TableCell align="center" width="5%">
                        Time
                      </TableCell>
                    </TableRow>
                  </CustomTableHeader>

                  <TableBody>
                    {addressDetail.latestTransactions?.map(tx => (
                      <TransactionRow key={tx.hash} transaction={tx} blockHeight={tx.height} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      </AddressLayout>
    </Layout>
  );
};

export default AddressDetailPage;

export const getServerSideProps = async ({ params, query }) => {
  try {
    const addressDetail = await fetchAddressData(params?.address as string, query.network as string);

    return {
      props: {
        address: params?.address,
        addressDetail
      }
    };
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return {
        notFound: true
      };
    } else {
      throw error;
    }
  }
};

async function fetchAddressData(address: string, network: string) {
  const apiUrl = network === "testnet" ? BASE_API_TESTNET_URL : BASE_API_MAINNET_URL;
  const response = await axios.get(`${apiUrl}/addresses/${address}`);
  return response.data;
}
