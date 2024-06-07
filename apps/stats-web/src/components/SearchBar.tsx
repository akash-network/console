"use client";
import { useEffect, useState } from "react";
import { fromBech32, normalizeBech32 } from "@cosmjs/encoding";
import { Search, Xmark } from "iconoir-react";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "usehooks-ts";

import { Button } from "@akashnetwork/ui/components";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";

import { breakpoints } from "@/lib/responsiveUtils";
import { UrlService } from "@/lib/urlUtils";

enum SearchType {
  AccountAddress,
  ValidatorAddress,
  TxHash,
  BlockHeight
}

const SearchBar: React.FunctionComponent = () => {
  const [searchTerms, setSearchTerms] = useState("");
  const [searchType, setSearchType] = useState<SearchType | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const hasSearchTerms = !!searchTerms.trim();
  const smallScreen = useMediaQuery(breakpoints.xs.mediaQuery);

  useEffect(() => {
    setSearchType(getSearchType(searchTerms));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerms]);

  function onSearchTermsChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerms(ev.target.value);
  }

  function onSubmit(ev: React.FormEvent) {
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

  function getSearchType(search: string): SearchType | null {
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

  function getSearchBtnLabel(searchType: SearchType | null) {
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
  };

  return (
    <div className="relative flex-grow">
      <form onSubmit={onSubmit}>
        <label className="relative block text-gray-400 focus-within:text-gray-600">
          <Input
            value={searchTerms}
            onChange={onSearchTermsChange}
            onClick={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search by Address, Block Height, TxHash..."
          />

          <div className="absolute right-0 top-0 flex items-center">
            {hasSearchTerms && (
              <Button
                type="button"
                size="icon"
                onClick={onClear}
                className="bg-transparent text-gray-400 hover:bg-transparent hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                <Xmark />
              </Button>
            )}

            {smallScreen ? (
              <Button variant="default" size="icon" type="submit" disabled={searchType === null || !hasSearchTerms} className="ml-2">
                <Search />
              </Button>
            ) : (
              <Button type="submit" disabled={searchType === null || !hasSearchTerms} className="ml-2">
                {getSearchBtnLabel(searchType)}
              </Button>
            )}
          </div>
        </label>

        {searchType === null && searchTerms.trim() && isFocused && (
          <div className="absolute -bottom-14 left-0 w-full">
            <Card>
              <CardContent className="!p-4">Invalid search term</CardContent>
            </Card>
          </div>
        )}
      </form>
    </div>
  );
};

export default SearchBar;
