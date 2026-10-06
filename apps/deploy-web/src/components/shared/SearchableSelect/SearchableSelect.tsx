import type { FC, ReactNode } from "react";
import { useId, useState } from "react";
import {
  Button,
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Check, ChevronDown } from "lucide-react";

export type SearchableSelectOption = {
  value: string;
  /** Rendered in the option row; may include trailing adornments (e.g. a lock icon). */
  label: ReactNode;
  /** Secondary text at the end of the row, announced as the option's description rather than its name. */
  hint?: ReactNode;
  /** Renders the row non-selectable and `aria-disabled`. */
  disabled?: boolean;
  /** Extra terms matched by the search box in addition to `value`. */
  keywords?: string[];
};

/** A leading "no selection" row (e.g. "Any region"/"Any GPU") that is always shown and never filtered out. */
type EmptyOption = {
  value: string;
  label: ReactNode;
  /** Secondary text at the end of the row (mirrors {@link SearchableSelectOption.hint}). */
  hint?: ReactNode;
  /** Renders the row non-selectable and `aria-disabled` (mirrors {@link SearchableSelectOption.disabled}). */
  disabled?: boolean;
};

type SharedProps = {
  options: SearchableSelectOption[];
  /** Listed after `options` under {@link SharedProps.unavailableHeading}, searchable but never selectable. */
  unavailableOptions?: SearchableSelectOption[];
  /** Groups `options` under a heading, with an optional column label above the hints, and separates every section. */
  optionsHeading?: { label: string; hintLabel?: ReactNode };
  unavailableHeading?: string;
  renderFooter?: (search: string, controls: { close: () => void }) => ReactNode;
  /** Accessible name of the trigger (which exposes `role="combobox"`). */
  ariaLabel: string;
  /** Accessible name of the search box inside the popover. */
  searchLabel: string;
  searchPlaceholder?: string;
  notFoundMessage: string;
  emptyOption?: EmptyOption;
  /** Trigger text while nothing is selected, in place of the empty option's label (which stays pickable in the list). */
  emptyTriggerLabel?: ReactNode;
  /** Trigger text when nothing is selected and no `emptyOption` is provided. */
  placeholder?: ReactNode;
  leadingIcon?: ReactNode;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

type SingleSelectProps = SharedProps & {
  value: string;
  onChange: (value: string) => void;
  /** Maps the selected raw `value` to what the trigger displays (e.g. a prettified label); defaults to the raw value. */
  renderValue?: (value: string) => ReactNode;
};

type MultiSelectProps = SharedProps & {
  value: string[];
  onChange: (value: string[]) => void;
  /** Maps the picked values to what the trigger displays; defaults to the values joined by commas. */
  renderValue?: (value: string[]) => ReactNode;
};

interface Selection {
  values: readonly string[];
  /** Renders the trigger text, called only while `values` is non-empty. */
  renderLabel: () => ReactNode;
  isMultiple: boolean;
  pick: (value: string) => void;
  clear: (emptyValue: string) => void;
}

/** cmdk requires a non-empty item value; the empty option owns this sentinel while reporting `emptyOption.value` on select. */
const EMPTY_OPTION_VALUE = "__searchable-select-empty__";

/**
 * A searchable single-select combobox: a trigger button opens a popover holding a
 * search box and the option list. Filtering is manual (`shouldFilter={false}`) over
 * each option's `value`/`keywords`, and the search resets whenever the popover closes.
 * Options render in the order given, so a consumer that wants a custom order sorts
 * `options` before passing them in.
 */
export const SearchableSelect: FC<SingleSelectProps> = ({ value, onChange, renderValue, ...props }) => (
  <SearchableSelectList
    {...props}
    selection={{
      values: value ? [value] : [],
      renderLabel: () => (renderValue ? renderValue(value) : value),
      isMultiple: false,
      pick: onChange,
      clear: onChange
    }}
  />
);

/** A picked option that has since become unavailable stays removable, or the pick could never be undone short of clearing all of it. */
export const SearchableMultiSelect: FC<MultiSelectProps> = ({ value, onChange, renderValue, ...props }) => (
  <SearchableSelectList
    {...props}
    selection={{
      values: value,
      renderLabel: () => (renderValue ? renderValue(value) : value.join(", ")),
      isMultiple: true,
      pick: picked => onChange(value.includes(picked) ? value.filter(current => current !== picked) : [...value, picked]),
      clear: () => onChange([])
    }}
  />
);

const SearchableSelectList: FC<SharedProps & { selection: Selection }> = ({
  selection,
  options,
  unavailableOptions = [],
  optionsHeading,
  unavailableHeading = "Unavailable",
  renderFooter,
  ariaLabel,
  searchLabel,
  searchPlaceholder,
  notFoundMessage,
  emptyOption,
  emptyTriggerLabel,
  placeholder,
  leadingIcon,
  disabled,
  triggerClassName,
  contentClassName
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const emptyOptionHintId = useId();
  const filteredOptions = filterOptions(options, search);
  const filteredUnavailableOptions = filterOptions(unavailableOptions, search);
  const checkedValues = selection.isMultiple ? new Set(selection.values) : undefined;
  const hasSelection = selection.values.length > 0;

  function closeAndResetSearch(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
    }
  }

  function selectValue(nextValue: string) {
    selection.pick(nextValue);
    if (!selection.isMultiple) {
      closeAndResetSearch(false);
    }
  }

  function renderOption(option: SearchableSelectOption, className?: string) {
    return <SearchableSelectItem key={option.value} option={option} checked={checkedValues?.has(option.value)} onSelect={selectValue} className={className} />;
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
          className={cn("w-full justify-between gap-1.5 bg-popover font-normal dark:bg-popover", triggerClassName)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {leadingIcon}
            <span className="truncate">{hasSelection ? selection.renderLabel() : emptyTriggerLabel ?? emptyOption?.label ?? placeholder}</span>
          </span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-[var(--radix-popover-trigger-width)] p-0", contentClassName)}>
        <Command label={searchLabel} shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList aria-multiselectable={selection.isMultiple || undefined}>
            {emptyOption && (
              <CommandItem
                value={EMPTY_OPTION_VALUE}
                disabled={emptyOption.disabled}
                aria-checked={checkedValues && !hasSelection}
                aria-describedby={emptyOption.hint ? emptyOptionHintId : undefined}
                onSelect={function selectEmptyOption() {
                  selection.clear(emptyOption.value);
                  closeAndResetSearch(false);
                }}
              >
                {checkedValues && <CheckIndicator checked={!hasSelection} />}
                {emptyOption.label}
                {emptyOption.hint && <OptionHint id={emptyOptionHintId}>{emptyOption.hint}</OptionHint>}
              </CommandItem>
            )}
            {optionsHeading
              ? filteredOptions.length > 0 && (
                  <>
                    {emptyOption && <CommandSeparator className="my-1" />}
                    <CommandGroup heading={<SectionHeading label={optionsHeading.label} hintLabel={optionsHeading.hintLabel} />} className="p-0">
                      {filteredOptions.map(option => renderOption(option, "pl-6"))}
                    </CommandGroup>
                  </>
                )
              : filteredOptions.map(option => renderOption(option))}
            {filteredUnavailableOptions.length > 0 && (
              <>
                {optionsHeading && <CommandSeparator className="my-1" />}
                <CommandGroup heading={optionsHeading ? <SectionHeading label={unavailableHeading} /> : unavailableHeading} className="p-0">
                  {filteredUnavailableOptions.map(option => renderOption({ ...option, disabled: !checkedValues?.has(option.value) }, "pl-6"))}
                </CommandGroup>
              </>
            )}
            {search && filteredOptions.length === 0 && filteredUnavailableOptions.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{notFoundMessage}</p>
            )}
          </CommandList>
          {renderFooter && <div className="border-t p-1">{renderFooter(search, { close: () => closeAndResetSearch(false) })}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const SectionHeading: FC<{ label: string; hintLabel?: ReactNode }> = ({ label, hintLabel }) => (
  <span className="flex items-center justify-between gap-2 font-mono uppercase tracking-wider">
    {label}
    {hintLabel && <span aria-hidden="true">{hintLabel}</span>}
  </span>
);

const CheckIndicator: FC<{ checked: boolean }> = ({ checked }) => (
  <Check aria-hidden="true" className={cn("mr-2 h-3.5 w-3.5 shrink-0", checked ? "opacity-100" : "opacity-0")} />
);

const SearchableSelectItem: FC<{ option: SearchableSelectOption; checked?: boolean; onSelect: (value: string) => void; className?: string }> = ({
  option,
  checked,
  onSelect,
  className
}) => {
  const hintId = useId();

  return (
    <CommandItem
      value={option.value}
      className={className}
      disabled={option.disabled}
      aria-checked={checked}
      aria-describedby={option.hint ? hintId : undefined}
      onSelect={function selectOption() {
        onSelect(option.value);
      }}
    >
      {checked !== undefined && <CheckIndicator checked={checked} />}
      {option.label}
      {option.hint && <OptionHint id={hintId}>{option.hint}</OptionHint>}
    </CommandItem>
  );
};

const OptionHint: FC<{ id: string; children: ReactNode }> = ({ id, children }) => (
  <span id={id} aria-hidden="true" className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">
    {children}
  </span>
);

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
