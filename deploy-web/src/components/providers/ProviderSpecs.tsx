import { Box, Chip, Paper } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { useRouter } from "next/router";
import { ClientProviderDetailWithStatus } from "@src/types/provider";
import { LabelValue } from "../shared/LabelValue";
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
  provider: Partial<ClientProviderDetailWithStatus>;
  providerAttributesSchema: ProviderAttributesSchema;
};

export const ProviderSpecs: React.FunctionComponent<Props> = ({ provider, providerAttributesSchema }) => {
  const { classes } = useStyles();
  const router = useRouter();

  return (
    <Paper className={classes.root}>
      <Box>
        <LabelValue label="GPU" value={provider.hardwareGpuVendor || "Unknown"} />
        <LabelValue label="CPU" value={provider.hardwareCpu || "Unknown"} />
        <LabelValue label="Memory (RAM)" value={provider.hardwareMemory || "Unknown"} />
        <LabelValue label="Persistent Storage" value={provider.featPersistentStorage && <CheckIcon sx={{ marginLeft: ".5rem" }} color="secondary" />} />
        <LabelValue label="Download speed" value={provider.networkSpeedDown} />
        <LabelValue label="Network Provider" value={provider.networkProvider} />
      </Box>

      <Box>
        <LabelValue
          label="GPU Models"
          value={provider.hardwareGpuModels.map(x => (
            <Chip key={x} label={x} size="small" sx={{ marginRight: ".5rem" }} />
          ))}
        />
        <LabelValue label="CPU Architecture" value={provider.hardwareCpuArch} />
        <LabelValue label="Disk Storage" value={provider.hardwareDisk} />
        <LabelValue label="Persistent Disk Storage" value={provider.featPersistentStorageType} />
        <LabelValue label="Upload speed" value={provider.networkSpeedUp} />
      </Box>
    </Paper>
  );
};
