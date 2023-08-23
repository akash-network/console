import { Box, Chip, Paper } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { useRouter } from "next/router";
import { ProviderDetail } from "@src/types/provider";
import { LabelValue } from "../shared/LabelValue";
import { getProviderAttributeValue } from "@src/utils/providerAttributes/helpers";
import CheckIcon from "@mui/icons-material/Check";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";

const useStyles = makeStyles()(theme => ({
  root: {
    padding: "1rem",
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: "1rem",
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(1,1fr)"
    }
  }
}));

type Props = {
  provider: Partial<ProviderDetail>;
  providerAttributesSchema: ProviderAttributesSchema;
};

export const ProviderSpecs: React.FunctionComponent<Props> = ({ provider, providerAttributesSchema }) => {
  const { classes } = useStyles();
  const router = useRouter();

  return (
    <Paper className={classes.root}>
      <Box>
        <LabelValue label="GPU" value={getProviderAttributeValue("hardware-gpu", provider, providerAttributesSchema) || "Unknown"} />
        <LabelValue label="CPU" value={getProviderAttributeValue("hardware-cpu", provider, providerAttributesSchema) || "Unknown"} />
        <LabelValue label="Memory (RAM)" value={getProviderAttributeValue("hardware-memory", provider, providerAttributesSchema) || "Unknown"} />
        <LabelValue
          label="Persistent Storage"
          value={
            getProviderAttributeValue("feat-persistent-storage", provider, providerAttributesSchema) === "true" && (
              <CheckIcon sx={{ marginLeft: ".5rem" }} color="secondary" />
            )
          }
        />
        <LabelValue label="Download speed" value={getProviderAttributeValue("network-speed-down", provider, providerAttributesSchema)} />
        <LabelValue label="Network Provider" value={getProviderAttributeValue("network-provider", provider, providerAttributesSchema)} />
      </Box>

      <Box>
        <LabelValue
          label="GPU Models"
          value={getProviderAttributeValue("hardware-gpu-model", provider, providerAttributesSchema)
            ?.split(",")
            .map(x => <Chip key={x} label={x} size="small" sx={{ marginRight: ".5rem" }} />)}
        />
        <LabelValue label="CPU Architecture" value={getProviderAttributeValue("hardware-cpu-arch", provider, providerAttributesSchema)} />
        <LabelValue label="Disk Storage" value={getProviderAttributeValue("hardware-disk", provider, providerAttributesSchema)} />
        <LabelValue label="Persistent Disk Storage" value={getProviderAttributeValue("feat-persistent-storage-type", provider, providerAttributesSchema)} />
        <LabelValue label="Upload speed" value={getProviderAttributeValue("network-speed-up", provider, providerAttributesSchema)} />
      </Box>
    </Paper>
  );
};
