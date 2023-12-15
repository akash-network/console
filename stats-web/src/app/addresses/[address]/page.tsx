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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { FormattedDecimal } from "@/components/FormattedDecimal";
import { AssetList } from "./AssetList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { MdMoneyOff } from "react-icons/md";
import { getSplitText } from "@/hooks/useShortText";
import { AssetAllocation } from "./AssetAllocation";
import { LatestTransactions } from "./LatestTransactions";

// type Props = {
//   address: string;
//   addressDetail: AddressDetail;
// };

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
  const url = `https://stats.akash.network${UrlService.address(address)}`;

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* <Paper sx={{ padding: 2, height: "100%" }} elevation={2}> */}
          <AssetList addressDetail={addressDetail} />
        </div>
        <div
        // item xs={12} sm={8}
        >
          <AssetAllocation address={address} addressDetail={addressDetail} />
        </div>
      </div>

      <div className="mt-4">
        <Title subTitle className="mb-4">
          Latest Transactions
        </Title>

        <LatestTransactions addressDetail={addressDetail} />
      </div>
    </AddressLayout>
  );
}
