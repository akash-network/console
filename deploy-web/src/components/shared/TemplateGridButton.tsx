import { Grid, Paper, Typography } from "@mui/material";
import { getShortText } from "@src/hooks/useShortText";
import { ITemplate } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { makeStyles } from "tss-react/mui";

type Props = {
  template: Partial<ITemplate>;
  onClick?: () => void;
};

const useStyles = makeStyles()(theme => ({
  templateButton: {
    height: "100%",
    cursor: "pointer",
    padding: "1rem",
    transition: "background-color .3s ease",
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]
    }
  }
}));

export const TemplateGridButton: React.FunctionComponent<Props> = ({ template, onClick }) => {
  const { classes } = useStyles();

  return (
    <Grid item xs={12} sm={6} lg={3}>
      <Link href={UrlService.template(template.id)} passHref>
        <Paper className={classes.templateButton} onClick={onClick}>
          <Typography variant="body1" sx={{ fontWeight: "bold" }}>
            {template.title}
          </Typography>
          <Typography variant="caption">{getShortText(template.description || "", 50)}</Typography>
        </Paper>
      </Link>
    </Grid>
  );
};
