"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import { UI } from "react-day-picker";
import { addDays, differenceInDays, format, isAfter, isBefore, isSameDay, max, min, startOfToday, subDays, subMonths, subYears } from "date-fns";
import { Calendar as CalendarIcon, NavArrowDown, NavArrowLeft, NavArrowRight, NavArrowUp, Refresh, Xmark } from "iconoir-react";

import { useMediaQuery } from "../../hooks";
import { cn } from "../../utils";
import { Button } from "../button";
import { Calendar } from "../calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Separator } from "../separator";

interface DateRangePickerProps {
  className?: string;
  date?: DateRange;
  onChange?: (date: DateRange | undefined) => void;
  minDate?: Date | null;
  maxDate?: Date | null;
  maxRangeInDays?: number;
  showPresets?: boolean;
  showWeekNumber?: boolean;
}

export function DateRangePicker({
  className,
  date,
  onChange,
  minDate = null,
  maxDate = null,
  maxRangeInDays,
  showPresets = true,
  showWeekNumber = true
}: DateRangePickerProps) {
  const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>(date);
  const [currentYear, setCurrentYear] = React.useState(new Date().getFullYear());
  const [open, setOpen] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(date?.from || new Date());
  const [presetsOpen, setPresetsOpen] = React.useState(false);
  const [monthsOpen, setMonthsOpen] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const today = React.useMemo(() => startOfToday(), []);

  const remainingRangeInDays = React.useMemo(() => {
    if (!selectedRange?.from || !selectedRange?.to || !maxRangeInDays) {
      return null;
    }

    const selectedRangeInDays = differenceInDays(selectedRange.to, selectedRange.from) + 1;

    if (selectedRangeInDays >= maxRangeInDays) {
      return 0;
    }

    return maxRangeInDays - selectedRangeInDays;
  }, [selectedRange?.from, selectedRange?.to, maxRangeInDays]);

  const effectiveMinDate = React.useMemo(() => {
    if (remainingRangeInDays === null || !selectedRange?.from) {
      return minDate;
    }

    const rangedMinDate = subDays(selectedRange.from, remainingRangeInDays);

    return minDate ? max([minDate, rangedMinDate]) : rangedMinDate;
  }, [minDate, selectedRange?.from, remainingRangeInDays]);

  const effectiveMaxDate = React.useMemo(() => {
    if (remainingRangeInDays === null || !selectedRange?.to) {
      return maxDate;
    }

    const rangedMaxDate = addDays(selectedRange.to, remainingRangeInDays);

    if (maxDate) {
      return min([maxDate, rangedMaxDate]);
    }

    return rangedMaxDate;
  }, [maxDate, selectedRange?.to, remainingRangeInDays]);

  const isDateDisabled = React.useCallback(
    (date: Date) => {
      return Boolean(effectiveMinDate && isBefore(date, effectiveMinDate)) || Boolean(effectiveMaxDate && isAfter(date, effectiveMaxDate));
    },
    [effectiveMinDate, effectiveMaxDate]
  );

  const getMonthMetadata = React.useCallback(
    (monthIndex: number) => {
      const monthStart = new Date(currentYear, monthIndex, 1);
      const monthEnd = new Date(currentYear, monthIndex + 1, 0);

      return {
        isDisabled: isDateDisabled(monthStart) || isDateDisabled(monthEnd) || !!(maxRangeInDays && differenceInDays(monthEnd, monthStart) + 1 > maxRangeInDays),
        isSelected: selectedRange?.from && selectedRange.to && isSameDay(selectedRange.from, monthStart) && isSameDay(selectedRange.to, monthEnd)
      };
    },
    [currentYear, selectedRange, isDateDisabled, maxRangeInDays]
  );

  const months = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        label: format(new Date(2024, i, 1), "MMMM"),
        ...getMonthMetadata(i)
      })),
    [getMonthMetadata]
  );

  const getPresetMetadata = React.useCallback(
    (from: Date) => {
      return {
        from,
        to: today,
        isDisabled:
          !!(minDate && isBefore(from, minDate)) ||
          !!(maxDate && isAfter(today, maxDate)) ||
          !!(maxRangeInDays && differenceInDays(today, from) + 1 > maxRangeInDays),
        isSelected: selectedRange?.from && selectedRange.to && isSameDay(selectedRange.from, from) && isSameDay(selectedRange.to, today)
      };
    },
    [selectedRange, minDate, maxDate, maxRangeInDays]
  );

  const presets = React.useMemo(
    () => [
      {
        label: "Last 7 days",
        ...getPresetMetadata(subDays(today, 6))
      },
      {
        label: "Last 30 days",
        ...getPresetMetadata(subDays(today, 29))
      },
      {
        label: "Last 3 months",
        ...getPresetMetadata(subMonths(today, 3))
      },
      {
        label: "Last year",
        ...getPresetMetadata(subYears(today, 1))
      }
    ],
    [today]
  );

  const selectPreset = React.useCallback(
    ({ from, to }: (typeof presets)[0]) => {
      setCalendarMonth(from);

      setSelectedRange({
        from,
        to
      });

      if (isMobile) {
        setPresetsOpen(false);
      }
    },
    [isMobile]
  );

  const selectMonth = React.useCallback(
    (monthIndex: number) => {
      const startDate = new Date(currentYear, monthIndex, 1);
      const endDate = new Date(currentYear, monthIndex + 1, 0);

      const range = { from: startDate, to: endDate };

      setCalendarMonth(startDate);

      setSelectedRange(range);

      if (isMobile) {
        setMonthsOpen(false);
      }
    },
    [currentYear, isMobile]
  );

  const applySelection = React.useCallback(() => {
    onChange?.(selectedRange);
    setOpen(false);
  }, [onChange, selectedRange]);

  const clearSelection = React.useCallback(() => {
    setSelectedRange(undefined);
  }, []);

  const changeYear = React.useCallback(
    (increment: number) => {
      const newYear = currentYear + increment;
      setCurrentYear(newYear);
      setCalendarMonth(new Date(newYear, calendarMonth.getMonth(), 1));
    },
    [currentYear, calendarMonth]
  );

  const toggleMonthsVisibility = React.useCallback((open: boolean) => {
    setMonthsOpen(open);

    if (open) {
      setPresetsOpen(false);
    }
  }, []);

  const togglePresetsVisibility = React.useCallback((open: boolean) => {
    setPresetsOpen(open);

    if (open) {
      setMonthsOpen(false);
    }
  }, []);

  if (isMobile) {
    return (
      <div className={cn("grid gap-2", className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant="outline"
              className={cn("h-12 w-full px-4 text-left font-normal", selectedRange ? "justify-between" : "text-muted-foreground")}
            >
              <CalendarIcon className="mr-3 h-5 w-5 flex-shrink-0" />
              <span className="truncate">
                {selectedRange?.from ? (
                  selectedRange.to ? (
                    <>
                      {format(selectedRange.from, "MMM dd")} - {format(selectedRange.to, "MMM dd, yyyy")}
                    </>
                  ) : (
                    format(selectedRange.from, "MMM dd, yyyy")
                  )
                ) : (
                  "Pick a date range"
                )}
              </span>
              {selectedRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-3 flex-shrink-0 p-0 hover:bg-transparent"
                  onClick={e => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                >
                  <Xmark className="h-5 w-5" />
                </Button>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="mx-4 w-screen max-w-sm p-0" align="center">
            <div className="space-y-4 p-4">
              {showPresets && (
                <Collapsible open={presetsOpen} onOpenChange={togglePresetsVisibility}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="h-12 w-full justify-between bg-transparent">
                      <span>Quick Select</span>
                      {presetsOpen ? <NavArrowUp className="h-4 w-4" /> : <NavArrowDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {presets.map(preset => {
                      return (
                        <Button
                          key={preset.label}
                          variant="ghost"
                          size="lg"
                          disabled={preset.isDisabled}
                          className={cn(
                            "h-12 w-full justify-start",
                            preset.isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                          )}
                          onClick={() => selectPreset(preset)}
                        >
                          {preset.label}
                        </Button>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}
              <Collapsible open={monthsOpen} onOpenChange={toggleMonthsVisibility}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="h-12 w-full justify-between bg-transparent">
                    <span>Select Month</span>
                    {monthsOpen ? <NavArrowUp className="h-4 w-4" /> : <NavArrowDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="lg" onClick={() => changeYear(-1)} className="h-12 gap-1 px-6">
                      <NavArrowLeft className="h-4 w-4" />
                      {currentYear - 1}
                    </Button>
                    <span className="text-lg font-medium">{currentYear}</span>
                    <Button variant="outline" size="lg" onClick={() => changeYear(1)} className="h-12 gap-1 px-6">
                      {currentYear + 1}
                      <NavArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {months.map((month, index) => {
                      return (
                        <Button
                          key={month.label}
                          variant="ghost"
                          size="lg"
                          className={cn(
                            "h-12 text-sm",
                            month.isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                          )}
                          onClick={() => selectMonth(index)}
                          disabled={month.isDisabled}
                        >
                          {month.label}
                        </Button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <Separator />
              <Calendar
                mode="range"
                showWeekNumber={showWeekNumber}
                defaultMonth={calendarMonth}
                selected={selectedRange}
                onSelect={setSelectedRange}
                numberOfMonths={1}
                className="rounded-md"
                key={calendarMonth.getTime()}
                disabled={isDateDisabled}
                classNames={{
                  [UI.Month]: "[&:not(:last-of-type)]:mb-4",
                  [UI.WeekNumberHeader]: "w-6",
                  [UI.WeekNumber]: "w-6 flex items-center justify-center text-xs text-muted-foreground",
                  [UI.MonthCaption]: "flex justify-center items-center h-7 mb-4"
                }}
              />
              <Separator />
              <div className="flex justify-between">
                <Button variant="secondary" size="sm" onClick={() => setCalendarMonth(today)}>
                  <Refresh width={12} className="mr-2" strokeWidth={2} />
                  Today
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearSelection} disabled={!selectedRange}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={applySelection} disabled={!selectedRange?.from || !selectedRange?.to}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id="date" variant="outline" className={cn("w-full justify-between text-left font-normal", !selectedRange && "text-muted-foreground")}>
            <div className="flex items-center">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedRange?.from ? (
                selectedRange.to ? (
                  <>
                    {format(selectedRange.from, "LLL dd, y")} - {format(selectedRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(selectedRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </div>
            {selectedRange && (
              <Button
                variant="ghost"
                className="ml-2 p-0 hover:bg-transparent"
                onClick={e => {
                  e.stopPropagation();
                  clearSelection();
                }}
              >
                <Xmark className="h-5 w-5" />
              </Button>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="min-w-[200px] border-r p-3">
              {showPresets && (
                <>
                  <div className="text-muted-foreground mb-2 text-xs font-medium">Quick Select</div>
                  <div className="mb-4 grid gap-1">
                    {presets.map(preset => {
                      return (
                        <Button
                          key={preset.label}
                          variant="ghost"
                          size="sm"
                          disabled={preset.isDisabled}
                          className={cn(
                            "h-8 justify-start px-2 text-xs",
                            preset.isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                          )}
                          onClick={() => selectPreset(preset)}
                        >
                          {preset.label}
                        </Button>
                      );
                    })}
                  </div>
                  <Separator className="mb-3" />
                </>
              )}

              <div className="mb-3 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => changeYear(-1)} className="h-7 w-7 p-0">
                  <NavArrowLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">{currentYear}</span>
                <Button variant="outline" size="sm" onClick={() => changeYear(1)} className="h-7 w-7 p-0">
                  <NavArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-1">
                <div className="text-muted-foreground mb-2 text-xs font-medium">Select Month</div>
                {months.map((month, index) => {
                  return (
                    <Button
                      key={month.label}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 justify-start px-2 text-xs",
                        month.isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                      )}
                      onClick={() => selectMonth(index)}
                      disabled={month.isDisabled}
                    >
                      {month.label} {currentYear}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="p-3">
              <Calendar
                autoFocus
                showWeekNumber={showWeekNumber}
                mode="range"
                defaultMonth={calendarMonth}
                selected={selectedRange}
                onSelect={setSelectedRange}
                numberOfMonths={2}
                className="rounded-md"
                key={calendarMonth.getTime()}
                disabled={isDateDisabled}
                classNames={{
                  [UI.Month]: "[&:not(:last-of-type)]:mb-4",
                  [UI.WeekNumberHeader]: "w-6",
                  [UI.WeekNumber]: "w-6 flex items-center justify-center text-xs text-muted-foreground",
                  [UI.MonthCaption]: "flex justify-center items-center h-7 mb-4"
                }}
              />

              <Separator className="my-3" />
              <div className="flex justify-between">
                <Button variant="secondary" size="sm" onClick={() => setCalendarMonth(today)}>
                  <Refresh width={14} className="mr-2" strokeWidth={2} />
                  Today
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearSelection} disabled={!selectedRange}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={applySelection} disabled={!selectedRange?.from || !selectedRange?.to}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
