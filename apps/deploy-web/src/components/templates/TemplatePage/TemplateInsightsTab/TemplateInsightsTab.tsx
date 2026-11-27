"use client";
import type { FC, ReactNode } from "react";
import { useId, useState } from "react";
import { Card, type ChartConfig, ChartContainer, ChartTooltip, Spinner, ToggleGroup, ToggleGroupItem } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format, parseISO } from "date-fns";
import { CircleAlert, Info, TrendingUp } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { useTemplateInsights } from "@src/queries/useUserTemplateQueries";
import type { TemplateInsightHint, TemplateInsightPeriod, TemplateInsights } from "@src/types/marketplace-template";
import { describeChange, describeHint, formatShare } from "./insightCopy";

export const DEPENDENCIES = {
  useTemplateInsights,
  ChartContainer
};

type DailyPoint = TemplateInsights["daily"][number];

type DailyMetric = keyof Pick<DailyPoint, "views" | "configureOpens" | "deploys">;

const PERIODS: TemplateInsightPeriod[] = [7, 30, 90];

const METRICS: { value: DailyMetric; label: string }[] = [
  { value: "views", label: "Views" },
  { value: "configureOpens", label: "Configure opens" },
  { value: "deploys", label: "Deploys" }
];

/** Above this many bars the gap between them shrinks to a hairline so 90 days still fit. */
const MAX_DAYS_WITH_WIDE_GAPS = 31;

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

const SECTION_LABEL_CLASSES = "font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground";

const TOGGLE_ITEM_CLASSES =
  "h-auto rounded-md px-2.5 py-1 text-xs font-normal text-muted-foreground data-[state=on]:bg-background data-[state=on]:font-medium data-[state=on]:text-foreground data-[state=on]:shadow-sm hover:bg-transparent hover:text-foreground";

const HINT_TONES: Record<TemplateInsightHint["tone"], { icon: typeof Info; label: string; classes: string }> = {
  warning: { icon: CircleAlert, label: "Needs attention", classes: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40" },
  info: { icon: Info, label: "Suggestion", classes: "border-border bg-muted/40" },
  positive: { icon: TrendingUp, label: "Going well", classes: "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40" }
};

export interface TemplateInsightsTabProps {
  templateId: string;
  isPublic: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const TemplateInsightsTab: FC<TemplateInsightsTabProps> = ({ templateId, isPublic, dependencies: d = DEPENDENCIES }) => {
  const [days, setDays] = useState<TemplateInsightPeriod>(30);
  const insightsQuery = d.useTemplateInsights(templateId, days, { enabled: true });
  const insights = insightsQuery.data;
  const selectPeriod = (period: TemplateInsightPeriod | undefined) => period && setDays(period);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">How people found, deployed and kept running this template.</p>
        <ToggleGroup
          type="single"
          value={String(days)}
          onValueChange={value => selectPeriod(PERIODS.find(period => String(period) === value))}
          aria-label="Period"
          className="gap-0.5 rounded-lg border bg-muted p-[3px]"
        >
          {PERIODS.map(period => (
            <ToggleGroupItem key={period} value={String(period)} aria-label={`Last ${period} days`} className={TOGGLE_ITEM_CLASSES}>
              {period} days
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {insights ? (
        <InsightsBody insights={insights} d={d} />
      ) : insightsQuery.isError ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Insights couldn&apos;t be loaded. Refresh the page to try again.
        </p>
      ) : (
        <div role="status" aria-label="Loading insights" className="flex justify-center py-14">
          <Spinner size="medium" />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Counted on mainnet. Views count signed-in people once a day.
        {isPublic && " Your organization's own views and deployments don't count."}
      </p>
    </div>
  );
};

const InsightsBody: FC<{ insights: TemplateInsights; d: typeof DEPENDENCIES }> = ({ insights, d }) => {
  const { current, previous, days } = insights;

  if (hasNoUsage(insights)) {
    return (
      <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        Nobody has viewed or deployed this template in the last {days} days. Numbers show up here once people use it.
      </p>
    );
  }

  return (
    <>
      {insights.hints.length > 0 && (
        <section aria-label="Suggestions" className="space-y-2">
          {insights.hints.map(hint => (
            <HintCard key={`${hint.kind}-${hint.version ?? ""}`} hint={hint} />
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Views" value={current.views} caption={describeChange(current.views, previous.views, days)} />
        <StatTile label="Configure opens" value={current.configureOpens} caption={describeChange(current.configureOpens, previous.configureOpens, days)} />
        <StatTile label="Deploys" value={current.deploys} caption={describeChange(current.deploys, previous.deploys, days)} />
        <StatTile label="Forks" value={current.forks} caption={describeChange(current.forks, previous.forks, days)} />
      </div>

      <DailyChart daily={insights.daily} d={d} />
      <Funnel insights={insights} />
      {insights.versions.length > 0 && <VersionTable versions={insights.versions} />}
    </>
  );
};

const StatTile: FC<{ label: string; value: number; caption: string }> = ({ label, value, caption }) => {
  const labelId = useId();

  return (
    <Card role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-1 rounded-xl px-4 py-3 shadow-none">
      <span id={labelId} className={SECTION_LABEL_CLASSES}>
        {label}
      </span>
      <span className="font-mono text-[22px] font-semibold tabular-nums leading-7">{NUMBER_FORMAT.format(value)}</span>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </Card>
  );
};

const HintCard: FC<{ hint: TemplateInsightHint }> = ({ hint }) => {
  const tone = HINT_TONES[hint.tone];
  const Icon = tone.icon;
  const { title, body } = describeHint(hint);

  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3", tone.classes)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          <span className="sr-only">{tone.label}: </span>
          {title}
        </p>
        <p className="mt-0.5 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
};

const CHART_CONFIG = { value: { label: "Count" } } satisfies ChartConfig;

const DailyChart: FC<{ daily: DailyPoint[]; d: typeof DEPENDENCIES }> = ({ daily, d }) => {
  const [metric, setMetric] = useState<DailyMetric>("views");
  const selectMetric = (option: DailyMetric | undefined) => option && setMetric(option);
  const metricLabel = METRICS.find(({ value }) => value === metric)!.label;
  const total = daily.reduce((sum, day) => sum + day[metric], 0);

  return (
    <Card className="rounded-xl px-5 pb-4 pt-4 shadow-none">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={SECTION_LABEL_CLASSES}>{metricLabel} by day</h3>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{NUMBER_FORMAT.format(total)}</p>
        </div>
        <ToggleGroup
          type="single"
          value={metric}
          onValueChange={value => selectMetric(METRICS.find(option => option.value === value)?.value)}
          aria-label="Shown by day"
          className="gap-0.5 rounded-lg border bg-muted p-[3px]"
        >
          {METRICS.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value} className={TOGGLE_ITEM_CLASSES}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {total === 0 ? (
        <p className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">No {metricLabel.toLowerCase()} in this period</p>
      ) : (
        <d.ChartContainer config={CHART_CONFIG} className="aspect-auto h-[120px] w-full">
          <BarChart
            accessibilityLayer
            data={daily.map(day => ({ day: day.day, value: day[metric] }))}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={daily.length > MAX_DAYS_WITH_WIDE_GAPS ? 1 : 4}
          >
            <XAxis dataKey="day" hide />
            <YAxis hide domain={[0, "dataMax"]} />
            <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<DayTooltip measure={metricLabel} />} />
            <Bar dataKey="value" fill="hsl(var(--foreground))" radius={2} isAnimationActive={false} />
          </BarChart>
        </d.ChartContainer>
      )}
      <div className="mt-2 flex justify-between font-mono text-[10px] tracking-[0.04em] text-muted-foreground">
        <span>{formatDay(daily[0].day)}</span>
        <span>{formatDay(daily[daily.length - 1].day)}</span>
      </div>
    </Card>
  );
};

export const DayTooltip: FC<{ active?: boolean; payload?: Array<{ payload: { day: string; value: number } }>; measure: string }> = ({ active, payload, measure }) => {
  if (!active || !payload?.length) return null;

  const { day, value } = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{formatDay(day)}</p>
      <p className="text-muted-foreground">
        {measure}: <span className="font-mono tabular-nums text-foreground">{NUMBER_FORMAT.format(value)}</span>
      </p>
    </div>
  );
};

type FunnelStep = { label: string; count: number; caption: ReactNode };

const Funnel: FC<{ insights: TemplateInsights }> = ({ insights: { current } }) => {
  const steps: FunnelStep[] = [
    { label: "Viewed", count: current.views, caption: null },
    { label: "Opened Configure", count: current.configureOpens, caption: shareOfStepBefore(current.configureOpens, current.views) },
    { label: "Deployed", count: current.deploys, caption: shareOfStepBefore(current.deploys, current.configureOpens) },
    {
      label: "Got a provider",
      count: current.leases,
      caption: current.leaseRate === null ? "Too few deployments to tell" : `${formatShare(current.leaseRate)} of deployments`
    },
    {
      label: "Still running after 24 h",
      count: current.stillRunning,
      caption:
        current.stillRunningRate === null
          ? "Too few deployments followed for a day to tell"
          : `${formatShare(current.stillRunningRate)} of the ${current.decidedLeases} followed for a day`
    }
  ];
  const widest = Math.max(...steps.map(({ count }) => count), 1);

  return (
    <Card className="rounded-xl px-5 py-4 shadow-none">
      <h3 className={SECTION_LABEL_CLASSES}>From view to running deployment</h3>
      <ol className="mt-3 space-y-2.5">
        {steps.map(({ label, count, caption }) => (
          <li key={label} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{label}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-sm bg-foreground" style={{ width: `${(count / widest) * 100}%`, minWidth: count > 0 ? 4 : 0 }} aria-hidden />
                <span className="font-mono text-xs tabular-nums">{NUMBER_FORMAT.format(count)}</span>
              </div>
              {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
};

const VersionTable: FC<{ versions: TemplateInsights["versions"] }> = ({ versions }) => (
  <Card className="rounded-xl px-5 py-4 shadow-none">
    <h3 className={SECTION_LABEL_CLASSES}>By version, all time</h3>
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="pb-2 font-normal">Version</th>
          <th className="pb-2 text-right font-normal">Deploys</th>
          <th className="pb-2 text-right font-normal">Got a provider</th>
          <th className="pb-2 text-right font-normal">Still running after 24 h</th>
        </tr>
      </thead>
      <tbody>
        {[...versions].reverse().map(version => (
          <tr key={version.version} className="border-t border-border">
            <td className="py-2 font-mono">v{version.version}</td>
            <td className="py-2 text-right font-mono tabular-nums">{NUMBER_FORMAT.format(version.deploys)}</td>
            <td className="py-2 text-right font-mono tabular-nums">{shareOrDash(version.leaseRate)}</td>
            <td className="py-2 text-right font-mono tabular-nums">{shareOrDash(version.stillRunningRate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="mt-2 text-xs text-muted-foreground">A dash means too few deployments to tell yet.</p>
  </Card>
);

function shareOfStepBefore(count: number, before: number): string | null {
  return before > 0 ? `${formatShare(Math.min(1, count / before))} of the step before` : null;
}

function shareOrDash(share: number | null): string {
  return share === null ? "—" : formatShare(share);
}

function formatDay(day: string): string {
  return format(parseISO(day), "MMM d");
}

function hasNoUsage({ current, previous, versions }: TemplateInsights): boolean {
  return current.views + current.configureOpens + current.deploys + current.forks + previous.views + previous.deploys === 0 && versions.length === 0;
}
