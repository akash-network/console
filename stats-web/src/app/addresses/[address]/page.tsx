
// import HelpIcon from "@mui/icons-material/Help";
// import QrCodeIcon from "@mui/icons-material/QrCode";
// import MoneyOffIcon from "@mui/icons-material/MoneyOff";
// import SendIcon from "@mui/icons-material/Send";
// import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
// import BookmarkIcon from "@mui/icons-material/Bookmark";
// import SearchOffIcon from "@mui/icons-material/SearchOff";
// import { SendAktModal } from "@src/components/address/SendAktModal";
// import { MustConnectModal } from "@src/components/shared/MustConnectModal";
import { AddressDetail } from "@/types";
import { customColors } from "@/lib/colors copy";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { Metadata, ResolvingMetadata } from "next";
import PageContainer from "@/components/PageContainer";
import AddressLayout from "./AddressLayout";
import { AddressInfo } from "./AddressInfo";
import { Title } from "@/components/Title";
import { UrlService } from "@/lib/urlUtils";

type Props = {
  address: string;
  addressDetail: AddressDetail;
};

// const useStyles = makeStyles()(theme => ({
//   tooltip: {
//     fontSize: ".8rem",
//     whiteSpace: "nowrap",
//     maxWidth: "none"
//   },
//   qrTooltip: {
//     padding: ".25rem .35rem"
//   }
// }));

interface IProps {
  params: { address: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { address } }: IProps, parent: ResolvingMetadata): Promise<Metadata> {
  const url = `https://deploy.cloudmos.io${UrlService.address(address)}`;

  return {
    title: `Account ${address}`,
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

async function fetchAddressData(address: string, network: string): Promise<AddressDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/addresses/${address}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching address data");
  }

  return response.json();
}

export default async function AddressDetailPage({ params: { address }, searchParams: { network } }: IProps) {
  const addressDetail = await fetchAddressData(address, network as string);
  // const { addressNames, editAddressName } = useAddressBook();
  // const [showMustConnectModal, setShowMustConnectModal] = useState<string>(null);
  // const { user } = useCustomUser();
  // const { classes } = useStyles();

  // async function onSendClick() {
  //   setIsShowingSendModal(true);

  //   event(AnalyticsEvents.ADDRESSES_SEND_TOKENS_CLICK, {
  //     category: "addresses",
  //     label: "Click to send tokens"
  //   });
  // }

  // <CustomNextSeo title={`Account ${address}`} url={`https://deploy.cloudmos.io${UrlService.address(address)}`} />
  // <SendAktModal onClose={() => setIsShowingSendModal(false)} open={isShowingSendModal} toAddress={address} />
  // {showMustConnectModal && <MustConnectModal message={showMustConnectModal} onClose={() => setShowMustConnectModal(null)} />}

  return (
    <AddressLayout page="address" address={address}>
      <AddressInfo address={address} addressDetail={addressDetail} />

      <div className="mt-4">
        <Title subTitle className="mb-4">
          Assets
        </Title>

        {/* <Grid container spacing={2}>
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
            <AssetList />
          </Grid>
        </Grid> */}
      </div>

      <div className="mt-4">
        <Title subTitle className="mb-4">
          Latest Transactions
        </Title>

        {/* <Paper sx={{ padding: 2, height: "100%" }} elevation={2}>
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

                <TableBody>{addressDetail.latestTransactions?.map(tx => <TransactionRow key={tx.hash} transaction={tx} blockHeight={tx.height} />)}</TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper> */}
      </div>
    </AddressLayout>
  );
}