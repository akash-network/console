import { useEffect, useState } from "react";
import { Box, Button, IconButton, InputAdornment, OutlinedInput, Paper, useTheme } from "@mui/material";
import { fromBech32, normalizeBech32 } from "@cosmjs/encoding";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { makeStyles } from "tss-react/mui";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";

type Props = {
  isMobileSearch: boolean;
  onSearchClose: () => void;
};

enum SearchType {
  AccountAddress,
  ValidatorAddress,
  TxHash,
  BlockHeight
}

const useStyles = makeStyles()(theme => ({
  searchBar: {
    "&::placeholder": {
      fontSize: ".75rem",
      fontWeight: 300,
      color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[700],
      opacity: 1
    }
  },
  button: {
    color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[700]
  },
  searchBarFocused: {
    borderColor: `${theme.palette.grey[500]}!important`
  }
}));

const SearchBar: React.FunctionComponent<Props> = ({ isMobileSearch, onSearchClose }) => {
  const [searchTerms, setSearchTerms] = useState("");
  const [searchType, setSearchType] = useState<SearchType>(null);
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const { classes } = useStyles();
  const hasSearchTerms = !!searchTerms.trim();

  useEffect(() => {
    setSearchType(getSearchType(searchTerms));
  }, [searchTerms]);

  function onSearchTermsChange(ev) {
    setSearchTerms(ev.target.value);
  }

  function onSubmit(ev) {
    ev.preventDefault();

    const trimmedSearch = searchTerms.trim();

    if (trimmedSearch.length === 0) return;

    const searchType = getSearchType(trimmedSearch);

    switch (searchType) {
      case SearchType.AccountAddress:
        router.push(UrlService.address(normalizeBech32(trimmedSearch)));
        break;
      case SearchType.ValidatorAddress:
        router.push(UrlService.validator(normalizeBech32(trimmedSearch)));
        break;
      case SearchType.TxHash:
        router.push(UrlService.transaction(trimmedSearch.toUpperCase()));
        break;
      case SearchType.BlockHeight:
        router.push(UrlService.block(parseInt(trimmedSearch)));
        break;
    }
  }

  function getSearchType(search: string): SearchType {
    // Check if valid block height
    if (/^[0-9]+$/.test(search)) {
      return SearchType.BlockHeight;
    }
    // Check if tx hash
    else if (/^[A-Fa-f0-9]{64}$/.test(search)) {
      return SearchType.TxHash;
    } else {
      // Check if valid bech32 address
      const bech32 = parseBech32(search);
      if (bech32?.prefix === "akash") {
        return SearchType.AccountAddress;
      } else if (bech32?.prefix === "akashvaloper") {
        return SearchType.ValidatorAddress;
      }
    }

    return null;
  }

  function parseBech32(str: string) {
    try {
      return fromBech32(str);
    } catch {
      return null;
    }
  }

  function getSearchBtnLabel(searchType: SearchType) {
    switch (searchType) {
      case SearchType.AccountAddress:
        return "Search Account";
      case SearchType.ValidatorAddress:
        return "Search Validator";
      case SearchType.TxHash:
        return "Search Transaction";
      case SearchType.BlockHeight:
        return "Search Block";
      default:
        return "Search";
    }
  }

  const onClear = () => {
    setSearchTerms("");
    setSearchType(null);

    if (isMobileSearch) {
      onSearchClose();
    }
  };

  return (
    <Box sx={{ padding: { xs: 0, sm: "1rem" }, maxWidth: { xs: "100%", sm: "100%", md: "600px" }, flexGrow: 1, position: "relative" }}>
      <form onSubmit={onSubmit}>
        <OutlinedInput
          fullWidth
          autoFocus
          value={searchTerms}
          onChange={onSearchTermsChange}
          onClick={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search by Address, Block Height, TxHash..."
          size="small"
          classes={{ input: classes.searchBar, notchedOutline: classes.searchBarFocused }}
          endAdornment={
            <InputAdornment position="end">
              {(hasSearchTerms || isMobileSearch) && (
                <IconButton type="button" size="small" classes={{ disabled: classes.button }} onClick={onClear}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}

              {isMobileSearch ? (
                <IconButton
                  type="submit"
                  disabled={searchType === null || !hasSearchTerms}
                  size="small"
                  classes={{ disabled: classes.button }}
                  sx={{ marginLeft: ".5rem" }}
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              ) : (
                <Button
                  type="submit"
                  disabled={searchType === null || !hasSearchTerms}
                  size="small"
                  classes={{ disabled: classes.button }}
                  sx={{ marginLeft: hasSearchTerms ? ".5rem" : 0 }}
                >
                  {getSearchBtnLabel(searchType)}
                </Button>
              )}
            </InputAdornment>
          }
        />

        {searchType === null && searchTerms.trim() && isFocused && (
          <Box sx={{ position: "absolute", left: 0, width: "100%", bottom: { xs: "-3rem", sm: "-2rem" } }}>
            <Paper elevation={2} sx={{ padding: ".5rem 1rem" }}>
              Invalid search term
            </Paper>
          </Box>
        )}
      </form>
    </Box>
  );
};

export default SearchBar;
