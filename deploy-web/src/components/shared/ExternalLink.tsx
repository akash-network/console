import { Box } from "@mui/material";
import Link from "next/link";
import LaunchIcon from "@mui/icons-material/Launch";

type Props = {
  href: string;
  text: string;
};

export const ExternalLink: React.FunctionComponent<Props> = ({ href, text }) => {
  return (
    (<Link href={href} passHref target="_blank" rel="noreferrer">

      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
        {text} <LaunchIcon fontSize="small" sx={{ marginLeft: ".2rem" }} />
      </Box>

    </Link>)
  );
};
