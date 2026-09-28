"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildChartSeries,
  buildWaiterSeries,
  defaultChartGroup,
  peakPoint,
  type ChartGroup,
  type ChartMetric,
  type ChartPoint,
} from "@/lib/history-chart";
import { formatMoney } from "@/lib/format";
import type { HistoryFilters } from "@/lib/order-filters";
import type { OrderWithDetails } from "@/lib/types";

const METRIC_OPTIONS: { value: ChartMetric; label: string }[] = [
  { value: "total", label: "Caixa" },
  { value: "count", label: "Pedidos" },
];

const GROUP_OPTIONS: { value: ChartGroup; label: string }[] = [
  { value: "hour", label: "Hora" },
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
];

function pointValue(point: ChartPoint, metric: ChartMetric) {
  return metric === "total" ? point.total : point.count;
}

function formatPointValue(point: ChartPoint, metric: ChartMetric) {
  return metric === "total" ? formatMoney(point.total) : `${point.count}`;
}

function VerticalBars({
  points,
  metric,
  selectedKey,
  onSelect,
}: {
  points: ChartPoint[];
  metric: ChartMetric;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const max = Math.max(...points.map((point) => pointValue(point, metric)), 0);

  return (
    <div className="bar-chart" role="img" aria-label="Gráfico do período">
      {points.map((point) => {
        const value = pointValue(point, metric);
        const height = max > 0 ? Math.max((value / max) * 100, value > 0 ? 8 : 0) : 0;
        const selected = point.key === selectedKey;

        return (
          <button
            key={point.key}
            type="button"
            className={`bar-chart-col${selected ? " is-selected" : ""}`}
            onClick={() => onSelect(point.key)}
          >
            <span className="bar-chart-track">
              <span
                className="bar-chart-bar"
                style={{ height: `${height}%` }}
              />
            </span>
            <span className="bar-chart-label">{point.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function HorizontalBars({
  points,
  metric,
}: {
  points: ChartPoint[];
  metric: ChartMetric;
}) {
  const max = Math.max(...points.map((point) => pointValue(point, metric)), 0);

  if (points.length === 0) {
    return <p className="small muted">Nenhum garçom neste período.</p>;
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {points.map((point) => {
        const value = pointValue(point, metric);
        const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 8 : 0) : 0;

        return (
          <div key={point.key} className="hbar-row">
            <div className="hbar-meta">
              <span>{point.label}</span>
              <span className="muted">{formatPointValue(point, metric)}</span>
            </div>
            <div className="hbar-track">
              <span className="hbar-bar" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HistoryCharts({
  orders,
  filters,
}: {
  orders: OrderWithDetails[];
  filters: HistoryFilters;
}) {
  const [metric, setMetric] = useState<ChartMetric>("total");
  const [group, setGroup] = useState<ChartGroup>(() =>
    defaultChartGroup(filters)
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    setGroup(defaultChartGroup(filters));
    setSelectedKey(null);
  }, [filters.period, filters.date]);

  const series = useMemo(
    () => buildChartSeries(orders, filters, group),
    [orders, filters, group]
  );
  const waiters = useMemo(() => buildWaiterSeries(orders), [orders]);
  const peak = useMemo(() => peakPoint(series, metric), [series, metric]);
  const selected =
    series.find((point) => point.key === selectedKey) ?? peak ?? null;

  return (
    <section className="card stack" style={{ marginBottom: 12 }}>
      <div>
        <strong>Análise do período</strong>
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          Toque nos botões para mudar a métrica e o recorte do gráfico.
        </p>
      </div>

      <div className="status-pills chart-pills" style={{ marginBottom: 0 }}>
        {METRIC_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={metric === option.value ? "active" : ""}
            onClick={() => setMetric(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="status-pills chart-pills" style={{ marginBottom: 0 }}>
        {GROUP_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={group === option.value ? "active" : ""}
            onClick={() => {
              setGroup(option.value);
              setSelectedKey(null);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {series.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          Sem dados para montar o gráfico.
        </p>
      ) : (
        <>
          <VerticalBars
            points={series}
            metric={metric}
            selectedKey={selected?.key ?? null}
            onSelect={setSelectedKey}
          />
          {selected ? (
            <p className="small muted" style={{ margin: 0 }}>
              {selected.label}: {formatPointValue(selected, metric)}
              {peak && peak.key === selected.key ? " · pico" : ""}
            </p>
          ) : null}
        </>
      )}

      <div>
        <strong className="small">Por garçom</strong>
      </div>
      <HorizontalBars points={waiters} metric={metric} />
    </section>
  );
}
