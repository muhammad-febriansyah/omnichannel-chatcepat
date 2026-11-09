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

// Day × hour heatmap (rows = days, columns = hours), e.g. busiest chat hours.
export function HeatmapChart({ rows, columns, values, height = 300, unit = "pesan" }: { rows: string[]; columns: string[]; values: number[][]; height?: number; unit?: string }) {
  const max = Math.max(0, ...values.flat());
  if (max === 0) {
    return (
      <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>
        Belum ada data di periode ini
      </div>
    );
  }
  // ApexCharts draws the first series at the bottom; reverse so Senin is on top.
  const series = rows.map((name, i) => ({ name, data: columns.map((x, j) => ({ x, y: values[i]?.[j] ?? 0 })) })).reverse();
  const step = Math.max(1, Math.ceil(max / 4));
  const options: ApexOptions = {
    ...base("number"),
    legend: { show: false },
    stroke: { width: 2, colors: ["#ffffff"] },
    plotOptions: {
      heatmap: {
        radius: 3,
        enableShades: false,
        colorScale: {
          ranges: [
            { from: 0, to: 0, color: "#eef0f7", name: "0" },
            { from: 1, to: step, color: "#c7d2fe", name: "Sepi" },
            { from: step + 1, to: step * 2, color: "#818cf8", name: "Sedang" },
            { from: step * 2 + 1, to: step * 3, color: "#4f46e5", name: "Ramai" },
            { from: step * 3 + 1, to: Number.MAX_SAFE_INTEGER, color: "#2547F9", name: "Tersibuk" },
          ],
        },
      },
    },
    xaxis: { type: "category", labels: { rotate: 0, hideOverlappingLabels: true, style: { fontSize: "10px" } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: "11px" } } },
    tooltip: { y: { formatter: (v: number) => `${fmt("number")(v)} ${unit}` } },
  };
  return <Chart type="heatmap" height={height} options={options} series={series} />;
}

// Single percentage gauge (0–100), e.g. automation rate or AI quota used.
export function RadialGauge({ value, label, color = CHART_COLORS[0], height = 240 }: { value: number; label: string; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const options: ApexOptions = {
    chart: { fontFamily: "var(--font-poppins), Poppins, sans-serif", sparkline: { enabled: true } },
    colors: [color],
    plotOptions: {
      radialBar: {
        startAngle: -120,
        endAngle: 120,
        hollow: { size: "62%" },
        track: { background: "#eef0f7", strokeWidth: "100%" },
        dataLabels: {
          name: { offsetY: 22, fontSize: "12px", color: "#6b7394" },
          value: { offsetY: -12, fontSize: "26px", fontWeight: 700, color, formatter: (n: number) => `${Math.round(n)}%` },
        },
      },
    },
    stroke: { lineCap: "round" },
    labels: [label],
  };
  return <Chart type="radialBar" height={height} options={options} series={[v]} />;
}

// Grouped horizontal bars per item (e.g. each broadcast: terkirim → dibaca → klik → gagal).
export function GroupedBarChart({ categories, series, height = 300, horizontal = true }: { categories: string[]; series: Series; height?: number; horizontal?: boolean }) {
  if (!series.some((x) => x.data.some((v) => v > 0))) {
    return (
      <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>
        Belum ada data di periode ini
      </div>
    );
  }
  const b = base("number");
  const options: ApexOptions = {
    ...b,
    colors: ["#2547F9", "#06B6D4", "#10B981", "#F59E0B", "#EF4444"],
    plotOptions: { bar: { horizontal, borderRadius: 4, barHeight: "75%", columnWidth: "60%", borderRadiusApplication: "end" } },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: { formatter: (v: string) => (horizontal ? fmt("number", true)(Number(v)) : v) } },
    yaxis: horizontal ? { labels: { style: { fontSize: "12px" }, maxWidth: 150 } } : b.yaxis,
  };
  return <Chart type="bar" height={height} options={options} series={series} />;
}
