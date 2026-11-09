"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";

// ApexCharts touches `window`, so it only renders in the browser.
const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-48 w-full rounded-xl" />,
});

export type ValueFormat = "rupiah" | "number" | "tokens";

export const CHART_COLORS = ["#2547F9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#64748B"];

function fmt(kind: ValueFormat, compact = false) {
  return (v: number) => {
    const n = Number(v) || 0;
    if (kind === "rupiah") {
      if (compact && n >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
      if (compact && n >= 1000) return `Rp${Math.round(n / 1000).toLocaleString("id-ID")}rb`;
      return `Rp${Math.round(n).toLocaleString("id-ID")}`;
    }
    if (compact && n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
    if (compact && n >= 1000) return `${(n / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb`;
    return Math.round(n).toLocaleString("id-ID");
  };
}

// Shared look: Poppins, no toolbar, light grid, soft colors.
function base(format: ValueFormat): ApexOptions {
  return {
    chart: {
      fontFamily: "var(--font-poppins), Poppins, sans-serif",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 400 },
      foreColor: "#6b7394",
    },
    colors: CHART_COLORS,
    grid: { borderColor: "#eef0f7", strokeDashArray: 4, padding: { left: 8, right: 8 } },
    dataLabels: { enabled: false },
    legend: { position: "top", horizontalAlign: "right", fontSize: "12px", markers: { size: 5 }, itemMargin: { horizontal: 8 } },
    tooltip: { y: { formatter: fmt(format) } },
    yaxis: { min: 0, forceNiceScale: true, labels: { formatter: fmt(format, true) } },
  };
}

type Series = { name: string; data: number[] }[];

// Area/line/bar over time (categories = x labels, e.g. dates).
export function TimeSeriesChart({
  type = "area",
  categories,
  series,
  format = "number",
  stacked = false,
  height = 300,
}: {
  type?: "area" | "bar" | "line";
  categories: string[];
  series: Series;
  format?: ValueFormat;
  stacked?: boolean;
  height?: number;
}) {
  const b = base(format);
  const options: ApexOptions = {
    ...b,
    chart: { ...b.chart, stacked },
    stroke: { curve: "smooth", width: type === "bar" ? 0 : 2.5 },
    fill:
      type === "area"
        ? { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 95] } }
        : { opacity: 1 },
    plotOptions: { bar: { borderRadius: 6, columnWidth: "48%", borderRadiusApplication: "end", borderRadiusWhenStacked: "last" } },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { rotate: 0, hideOverlappingLabels: true, style: { fontSize: "11px" } },
      tickAmount: Math.min(categories.length, 10),
    },
  };
  if (!series.some((x) => x.data.some((v) => v > 0))) {
    return (
      <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>
        Belum ada data di periode ini
      </div>
    );
  }
  return <Chart type={type} height={height} options={options} series={series} />;
}

// Donut with total in the middle.
export function DonutChart({
  labels,
  values,
  format = "number",
  totalLabel = "Total",
  height = 280,
}: {
  labels: string[];
  values: number[];
  format?: ValueFormat;
  totalLabel?: string;
  height?: number;
}) {
  const b = base(format);
  const options: ApexOptions = {
    ...b,
    labels,
    legend: { ...b.legend, position: "bottom", horizontalAlign: "center" },
    stroke: { width: 3, colors: ["#ffffff"] },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            value: { fontSize: "20px", fontWeight: 700, color: "#1b2559", formatter: (v: string) => fmt(format, true)(Number(v)) },
            total: {
              show: true,
              label: totalLabel,
              fontSize: "12px",
              color: "#6b7394",
              formatter: (w: { globals: { seriesTotals: number[] } }) => fmt(format, true)(w.globals.seriesTotals.reduce((a, c) => a + c, 0)),
            },
          },
        },
      },
    },
  };
  if (!values.some((v) => v > 0)) {
    return <div className="grid h-full min-h-48 place-items-center text-sm text-muted-foreground">Belum ada data di periode ini</div>;
  }
  return <Chart type="donut" height={height} options={options} series={values} />;
}

// Horizontal bar ranking (e.g. top tenants).
export function RankingChart({ labels, values, format = "number", height = 300 }: { labels: string[]; values: number[]; format?: ValueFormat; height?: number }) {
  const b = base(format);
  const options: ApexOptions = {
    ...b,
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: "55%", borderRadiusApplication: "end", distributed: true } },
    legend: { show: false },
    xaxis: { categories: labels, labels: { formatter: (v: string) => fmt(format, true)(Number(v)) }, axisBorder: { show: false } },
    yaxis: { labels: { style: { fontSize: "12px" }, maxWidth: 160 } },
  };
  if (!values.some((v) => v > 0)) {
    return <div className="grid h-full min-h-48 place-items-center text-sm text-muted-foreground">Belum ada data di periode ini</div>;
  }
  return <Chart type="bar" height={height} options={options} series={[{ name: "Nilai", data: values }]} />;
}
