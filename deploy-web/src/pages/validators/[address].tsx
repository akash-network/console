import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import { BASE_API_MAINNET_URL, BASE_API_TESTNET_URL } from "@src/utils/constants";
import axios from "axios";
import { ValidatorDetail } from "@src/types/validator";
import { FormattedNumber } from "react-intl";
import { Avatar, Badge, Box } from "@mui/material";
import { isValidHttpUrl } from "@src/utils/urlUtils";
import { LabelValue } from "@src/components/shared/LabelValue";
import { NextSeo } from "next-seo";
import { Title } from "@src/components/shared/Title";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useRouter } from "next/router";

type Props = {
  address: string;
  validator: ValidatorDetail;
};

const useStyles = makeStyles()(theme => ({}));

const ValidatorDetailPage: React.FunctionComponent<Props> = ({ address, validator }) => {
  const { user } = useCustomUser();
  const router = useRouter();
  const { classes } = useStyles();
  const theme = useTheme();

  let website = validator.website?.trim();

  if (website && !/^https?:\/\//i.test(website) && isValidHttpUrl("http://" + website)) {
    website = "http://" + website;
  }

  return (
    <Layout>
      <NextSeo title={`Validator ${validator.moniker}`} />

      <PageContainer>
        <Title value="Validator Details" />

        <Paper sx={{ padding: 2 }} elevation={2}>
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
          {/* <LabelValue
            label="Address"
            value={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Link href={UrlService.address(validator.address)}>
                  <a>{validator.address}</a>
                </Link>

                <AddressAlertCreateButtonLink sx={{ marginLeft: "1rem" }} address={address} />
              </Box>
            }
          /> */}
          <LabelValue label="Voting Power" value={<AKTAmount uakt={validator.votingPower} showAKTLabel showUSD />} />
          <LabelValue label="Commission" value={<FormattedNumber style="percent" value={validator.commission} minimumFractionDigits={2} />} />
          <LabelValue label="Max Commission" value={<FormattedNumber style="percent" value={validator.maxCommission} minimumFractionDigits={2} />} />
          <LabelValue
            label="Max Commission Change"
            value={<FormattedNumber style="percent" value={validator.maxCommissionChange} minimumFractionDigits={2} />}
          />
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
        </Paper>
      </PageContainer>
    </Layout>
  );
};

export default ValidatorDetailPage;

export async function getServerSideProps({ params, query }) {
  try {
    const validator = await fetchValidatorData(params?.address, query.network as string);

    return {
      props: {
        address: params?.address,
        validator
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
}

async function fetchValidatorData(address: string, network: string) {
  const apiUrl = network === "testnet" ? BASE_API_TESTNET_URL : BASE_API_MAINNET_URL;
  const response = await axios.get(`${apiUrl}/validators/${address}`);
  return response.data;
}
