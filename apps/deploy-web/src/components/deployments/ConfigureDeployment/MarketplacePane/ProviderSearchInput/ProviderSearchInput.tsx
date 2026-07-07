import type { FC } from "react";
import { Input } from "@akashnetwork/ui/components";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export const ProviderSearchInput: FC<Props> = ({ value, onChange, onClear }) => {
  return (
    <Input
      type="search"
      aria-label="Search providers"
      placeholder="Search providers..."
      value={value}
      onChange={event => onChange(event.target.value)}
      className="w-56 shrink-0"
      inputClassName="h-9 [&::-ms-clear]:hidden [&::-webkit-search-cancel-button]:appearance-none"
      startIcon={<Search className="ml-3 h-4 w-4 text-muted-foreground" />}
      endIcon={
        value ? (
          <button type="button" aria-label="Clear search" onClick={onClear} className="mr-3 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        ) : undefined
      }
    />
  );
};
