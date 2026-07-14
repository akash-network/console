import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Button, Command, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown } from "iconoir-react";

export type SearchableSelectOption = {
  value: string;
  /** Rendered in the option row; may include trailing adornments (e.g. a lock icon). */
  label: ReactNode;
  /** Renders the row non-selectable and `aria-disabled`. */
  disabled?: boolean;
  /** Extra terms matched by the search box in addition to `value`. */
  keywords?: string[];
};

/** A leading "no selection" row (e.g. "Any region"/"Any model") that is always shown and never filtered out. */
type EmptyOption = { value: string; label: ReactNode };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  /** Accessible name of the trigger (which exposes `role="combobox"`). */
  ariaLabel: string;
  /** Accessible name of the search box inside the popover. */
  searchLabel: string;
  searchPlaceholder?: string;
  notFoundMessage: string;
  emptyOption?: EmptyOption;
  /** Trigger text when nothing is selected and no `emptyOption` is provided. */
  placeholder?: ReactNode;
  leadingIcon?: ReactNode;
  disabled?: boolean;
  triggerClassName?: string;
  /** Maps the selected raw `value` to what the trigger displays (e.g. a prettified label); defaults to the raw value. */
  renderValue?: (value: string) => ReactNode;
};

/** cmdk requires a non-empty item value; the empty option owns this sentinel while reporting `emptyOption.value` on select. */
const EMPTY_OPTION_VALUE = "__searchable-select-empty__";

/**
 * A searchable single-select combobox: a trigger button opens a popover holding a
 * search box and the option list. Filtering is manual (`shouldFilter={false}`) over
 * each option's `value`/`keywords`, and the search resets whenever the popover closes.
 * Options render in the order given, so a consumer that wants a custom order sorts
 * `options` before passing them in.
 */
export const SearchableSelect: FC<Props> = ({
  value,
  onChange,
  options,
  ariaLabel,
  searchLabel,
  searchPlaceholder,
  notFoundMessage,
  emptyOption,
  placeholder,
  leadingIcon,
  disabled,
  triggerClassName,
  renderValue
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredOptions = filterOptions(options, search);

  function closeAndResetSearch(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
    }
  }

  function selectValue(nextValue: string) {
    onChange(nextValue);
    closeAndResetSearch(false);
  }

  return (
    <Popover open={open} onOpenChange={closeAndResetSearch}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between gap-1.5 font-normal", triggerClassName)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {leadingIcon}
            <span className="truncate">{value ? (renderValue ? renderValue(value) : value) : emptyOption?.label ?? placeholder}</span>
          </span>
          <NavArrowDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command label={searchLabel} shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList>
            {emptyOption && (
              <CommandItem
                value={EMPTY_OPTION_VALUE}
                onSelect={function selectEmptyOption() {
                  selectValue(emptyOption.value);
                }}
              >
                {emptyOption.label}
              </CommandItem>
            )}
            {filteredOptions.map(option => (
              <CommandItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                onSelect={function selectOption() {
                  selectValue(option.value);
                }}
              >
                {option.label}
              </CommandItem>
            ))}
            {search && filteredOptions.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{notFoundMessage}</p>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/** Case-insensitive substring match over each option's `value` and `keywords`; an empty/whitespace query returns every option. */
export function filterOptions(options: SearchableSelectOption[], query: string): SearchableSelectOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return options;
  }
  return options.filter(
    option => option.value.toLowerCase().includes(normalized) || (option.keywords ?? []).some(keyword => keyword.toLowerCase().includes(normalized))
  );
}
