import { FormattedNumber } from "react-intl";
import { Metadata, ResolvingMetadata } from "next";
import { UrlService, isValidHttpUrl } from "@/lib/urlUtils";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { ValidatorDetail } from "@/types";
import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";

interface IProps {
  params: { address: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { address }, searchParams: { network } }: IProps, parent: ResolvingMetadata): Promise<Metadata> {
  const url = `https://stats.akash.network${UrlService.validator(address)}`;
  const apiUrl = getNetworkBaseApiUrl(network as string);
  const response = await fetch(`${apiUrl}/validators/${address}`);
  const data = (await response.json()) as ValidatorDetail;

  return {
    title: `Validator ${data.moniker}`,
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

async function fetchValidatorData(address: string, network: string): Promise<ValidatorDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/validators/${address}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching validator data");
  }

  return response.json();
}

export default async function ValidatorDetailPage({ params: { address }, searchParams: { network } }: IProps) {
  const validator = await fetchValidatorData(address, network as string);

  let website = validator.website?.trim();

  if (website && !/^https?:\/\//i.test(website) && isValidHttpUrl("http://" + website)) {
    website = "http://" + website;
  }

  return (
    <PageContainer>
      <Title>Validator Details</Title>
      Coming soon!
      {/* <Paper sx={{ padding: 2 }} elevation={2}>
        <Box style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
          <Box mr={2}>
            <Badge color="secondary" badgeContent={validator.rank} overlap="circular">
              <Avatar src={validator.keybaseAvatarUrl} sx={{ width: "5rem", height: "5rem" }} />
            </Badge>
          </Box>
          <Typography variant="h3" sx={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            {validator.moniker}
          </Typography>
        </Box>

        <LabelValue label="Operator Address" value={validator.operatorAddress} />
        <LabelValue label="Voting Power" value={<AKTAmount uakt={validator.votingPower} showAKTLabel showUSD />} />
        <LabelValue label="Commission" value={<FormattedNumber style="percent" value={validator.commission} minimumFractionDigits={2} />} />
        <LabelValue label="Max Commission" value={<FormattedNumber style="percent" value={validator.maxCommission} minimumFractionDigits={2} />} />
        <LabelValue label="Max Commission Change" value={<FormattedNumber style="percent" value={validator.maxCommissionChange} minimumFractionDigits={2} />} />
        <LabelValue
          label="Website"
          value={
            website && (
              <>
                {isValidHttpUrl(website) ? (
                  <a href={website} target="_blank">
                    {website}
                  </a>
                ) : (
                  website
                )}
              </>
            )
          }
        />
        <LabelValue
          label="Identity"
          value={
            validator?.keybaseUsername ? (
              <a href={"https://keybase.io/" + validator?.keybaseUsername} target="_blank">
                {validator.identity}
              </a>
            ) : (
              <>{validator.identity}</>
            )
          }
        />
        <LabelValue label="Description" value={<Box sx={{ wordBreak: "normal" }}>{validator.description}</Box>} />
      </Paper> */}
    </PageContainer>
  );
}

// export default ValidatorDetailPage;

// export async function getServerSideProps({ params, query }) {
//   try {
//     const validator = await fetchValidatorData(params?.address, query.network as string);

//     return {
//       props: {
//         address: params?.address,
//         validator
//       }
//     };
//   } catch (error) {
//     if (error.response?.status === 404 || error.response?.status === 400) {
//       return {
//         notFound: true
//       };
//     } else {
//       throw error;
//     }
//   }
// }

// async function fetchValidatorData(address: string, network: string) {
//   const apiUrl = getNetworkBaseApiUrl(network);
//   const response = await axios.get(`${apiUrl}/validators/${address}`);
//   return response.data;
// }
