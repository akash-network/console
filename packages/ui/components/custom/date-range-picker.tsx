"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import { differenceInDays, format, isAfter, isBefore, startOfDay, subDays, subMonths, subYears } from "date-fns";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from "lucide-react";

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
  onDateChange?: (date: DateRange | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  maxRangeInDays?: number;
  disableFuture?: boolean;
  showPresets?: boolean;
}

export function DateRangePicker({
  className,
  date,
  onDateChange,
  minDate,
  maxDate,
  maxRangeInDays,
  disableFuture = false,
  showPresets = true
}: DateRangePickerProps) {
  const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>(date);
  const [currentYear, setCurrentYear] = React.useState(new Date().getFullYear());
  const [open, setOpen] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(date?.from || new Date());
  const [presetsOpen, setPresetsOpen] = React.useState(false);
  const [monthsOpen, setMonthsOpen] = React.useState(false);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const today = startOfDay(new Date());
  const effectiveMaxDate = disableFuture ? today : maxDate;
  const effectiveMinDate = minDate;

  const months = Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), "MMMM"));

  const presets = [
    {
      label: "Last 7 days",
      getValue: () => ({
        from: subDays(today, 6),
        to: today
      })
    },
    {
      label: "Last 30 days",
      getValue: () => ({
        from: subDays(today, 29),
        to: today
      })
    },
    {
      label: "Last 3 months",
      getValue: () => ({
        from: subMonths(today, 3),
        to: today
      })
    },
    {
      label: "Last year",
      getValue: () => ({
        from: subYears(today, 1),
        to: today
      })
    }
  ];

  const validateDateRange = (range: DateRange | undefined): string | null => {
    if (!range?.from || !range?.to) return null;

    if (effectiveMinDate && isBefore(range.from, effectiveMinDate)) {
      return `Start date cannot be before ${format(effectiveMinDate, "MMM dd, yyyy")}`;
    }
    if (effectiveMaxDate && isAfter(range.to, effectiveMaxDate)) {
      return `End date cannot be after ${format(effectiveMaxDate, "MMM dd, yyyy")}`;
    }

    if (maxRangeInDays) {
      const daysDiff = differenceInDays(range.to, range.from) + 1;
      if (daysDiff > maxRangeInDays) {
        return `Date range cannot exceed ${maxRangeInDays} days`;
      }
    }

    return null;
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    const error = validateDateRange(range);
    if (error) {
      console.warn(error);
      return;
    }

    setSelectedRange(range);
  };

  const handlePresetSelect = (preset: (typeof presets)[0]) => {
    const range = preset.getValue();
    const error = validateDateRange(range);
    if (error) {
      console.warn(error);
      return;
    }

    setCalendarMonth(range.from);
    handleDateSelect(range);
    if (isMobile) {
      setPresetsOpen(false);
    }
  };

  const handleMonthSelect = (monthIndex: number) => {
    const startDate = new Date(currentYear, monthIndex, 1);
    const endDate = new Date(currentYear, monthIndex + 1, 0);
    const range = { from: startDate, to: endDate };

    const error = validateDateRange(range);
    if (error) {
      console.warn(error);
      return;
    }

    setCalendarMonth(startDate);
    handleDateSelect(range);
    if (isMobile) {
      setMonthsOpen(false);
    }
  };

  const handleApply = () => {
    onDateChange?.(selectedRange);
    setOpen(false);
  };

  const handleClear = () => {
    handleDateSelect(undefined);
  };

  const handleYearChange = (increment: number) => {
    const newYear = currentYear + increment;
    setCurrentYear(newYear);
    setCalendarMonth(new Date(newYear, calendarMonth.getMonth(), 1));
  };

  const isDateDisabled = (date: Date) => {
    if (effectiveMinDate && isBefore(date, effectiveMinDate)) return true;
    if (effectiveMaxDate && isAfter(date, effectiveMaxDate)) return true;
    return false;
  };

  if (isMobile) {
    return (
      <div className={cn("grid gap-2", className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant="outline"
              className={cn("h-12 w-full justify-between px-4 text-left font-normal", !selectedRange && "text-muted-foreground")}
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
                  className="ml-3 h-6 w-6 flex-shrink-0 p-0 hover:bg-transparent"
                  onClick={e => {
                    e.stopPropagation();
                    handleClear();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="mx-4 w-screen max-w-sm p-0" align="center">
            <div className="space-y-4 p-4">
              {showPresets && (
                <Collapsible open={presetsOpen} onOpenChange={setPresetsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="h-12 w-full justify-between bg-transparent">
                      <span>Quick Select</span>
                      {presetsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {presets.map(preset => (
                      <Button key={preset.label} variant="ghost" size="lg" className="h-12 w-full justify-start" onClick={() => handlePresetSelect(preset)}>
                        {preset.label}
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              <Collapsible open={monthsOpen} onOpenChange={setMonthsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="h-12 w-full justify-between bg-transparent">
                    <span>Select Month</span>
                    {monthsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="lg" onClick={() => handleYearChange(-1)} className="h-12 px-6">
                      <ChevronLeft className="h-4 w-4" />
                      {currentYear - 1}
                    </Button>
                    <span className="text-lg font-medium">{currentYear}</span>
                    <Button variant="outline" size="lg" onClick={() => handleYearChange(1)} className="h-12 px-6">
                      {currentYear + 1}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {months.map((month, index) => {
                      const monthStart = new Date(currentYear, index, 1);
                      const monthEnd = new Date(currentYear, index + 1, 0);
                      const isDisabled = isDateDisabled(monthStart) || isDateDisabled(monthEnd);

                      return (
                        <Button key={month} variant="ghost" size="lg" className="h-12 text-sm" onClick={() => handleMonthSelect(index)} disabled={isDisabled}>
                          {month}
                        </Button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              <Calendar
                mode="range"
                defaultMonth={calendarMonth}
                selected={selectedRange}
                onSelect={handleDateSelect}
                numberOfMonths={1}
                className="rounded-md"
                key={calendarMonth.getTime()}
                disabled={isDateDisabled}
                fromDate={effectiveMinDate}
                toDate={effectiveMaxDate}
              />

              <Separator />

              <div className="flex gap-3">
                <Button variant="outline" size="lg" onClick={handleClear} disabled={!selectedRange} className="h-12 flex-1 bg-transparent">
                  Clear
                </Button>
                <Button size="lg" onClick={handleApply} disabled={!selectedRange?.from || !selectedRange?.to} className="h-12 flex-1">
                  Apply
                </Button>
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
          <Button id="date" variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedRange && "text-muted-foreground")}>
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
            {selectedRange && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-4 w-4 p-0 hover:bg-transparent"
                onClick={e => {
                  e.stopPropagation();
                  handleClear();
                }}
              >
                <X className="h-3 w-3" />
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
                    {presets.map(preset => (
                      <Button
                        key={preset.label}
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-start px-2 text-xs"
                        onClick={() => handlePresetSelect(preset)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <Separator className="mb-3" />
                </>
              )}

              <div className="mb-3 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => handleYearChange(-1)} className="h-7 w-7 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">{currentYear}</span>
                <Button variant="outline" size="sm" onClick={() => handleYearChange(1)} className="h-7 w-7 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-1">
                <div className="text-muted-foreground mb-2 text-xs font-medium">Select Month</div>
                {months.map((month, index) => {
                  const monthStart = new Date(currentYear, index, 1);
                  const monthEnd = new Date(currentYear, index + 1, 0);
                  const isDisabled = isDateDisabled(monthStart) || isDateDisabled(monthEnd);

                  return (
                    <Button
                      key={month}
                      variant="ghost"
                      size="sm"
                      className="h-8 justify-start px-2 text-xs"
                      onClick={() => handleMonthSelect(index)}
                      disabled={isDisabled}
                    >
                      {month} {currentYear}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="p-3">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={calendarMonth}
                selected={selectedRange}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                className="rounded-md"
                key={calendarMonth.getTime()}
                disabled={isDateDisabled}
                fromDate={effectiveMinDate}
                toDate={effectiveMaxDate}
              />

              <Separator className="my-3" />

              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={handleClear} disabled={!selectedRange}>
                  Clear
                </Button>
                <Button size="sm" onClick={handleApply} disabled={!selectedRange?.from || !selectedRange?.to}>
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
