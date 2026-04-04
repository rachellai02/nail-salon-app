"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type SummaryTx = {
  transacted_at: string;
  total: number;
};

type Props = {
  transactions: SummaryTx[];
  onMonthClick?: (year: number, month: number) => void;
  onDayClick?: (year: number, month: number, day: number) => void;
};

export default function SalesSummaryClient({ transactions, onMonthClick, onDayClick }: Props) {
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    type DayMap = Record<string, number>;
    type MonthData = { total: number; days: DayMap };
    type YearData = { total: number; months: Record<string, MonthData> };
    const g: Record<string, YearData> = {};
    for (const tx of transactions) {
      const d = tx.transacted_at.slice(0, 10);
      const [y, m, day] = d.split("-");
      if (!g[y]) g[y] = { total: 0, months: {} };
      g[y].total += Number(tx.total);
      if (!g[y].months[m]) g[y].months[m] = { total: 0, days: {} };
      g[y].months[m].total += Number(tx.total);
      g[y].months[m].days[day] = (g[y].months[m].days[day] ?? 0) + Number(tx.total);
    }
    return g;
  }, [transactions]);

  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  function toggleYear(y: string) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      next.has(y) ? next.delete(y) : next.add(y);
      return next;
    });
  }

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
            <th className="px-5 py-3 text-left font-medium w-36">Year</th>
            <th className="px-5 py-3 text-left font-medium">Month</th>
            <th className="px-5 py-3 text-right font-medium w-40">Sales (RM)</th>
          </tr>
        </thead>
        <tbody>
          {years.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center text-gray-400 py-10 text-sm">
                No transactions found.
              </td>
            </tr>
          )}
          {years.flatMap((year) => {
            const isYearExpanded = expandedYears.has(year);
            const sortedMonths = Object.keys(grouped[year].months).sort(
              (a, b) => Number(b) - Number(a)
            );

            const yearRow = (
              <tr
                key={year}
                className="border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleYear(year)}
              >
                <td className="px-5 py-3 font-semibold">
                  <span className="flex items-center gap-2">
                    {isYearExpanded ? (
                      <ChevronDown size={14} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-400 shrink-0" />
                    )}
                    {year}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-400">—</td>
                <td className="px-5 py-3 text-right font-semibold">
                  {grouped[year].total.toFixed(2)}
                </td>
              </tr>
            );

            if (!isYearExpanded) return [yearRow];

            const monthRows = sortedMonths.flatMap((month) => {
              const monthKey = `${year}-${month}`;
              const isMonthExpanded = expandedMonths.has(monthKey);
              const monthData = grouped[year].months[month];
              const sortedDays = Object.keys(monthData.days).sort(
                (a, b) => Number(b) - Number(a)
              );
              const monthName = MONTH_NAMES[Number(month) - 1];

              const monthRow = (
                <tr
                  key={monthKey}
                  className="border-b hover:bg-blue-50 cursor-pointer bg-gray-50/40"
                  onClick={() => toggleMonth(monthKey)}
                >
                  <td className="px-5 py-3 text-gray-400 text-xs pl-10">{year}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      {isMonthExpanded ? (
                        <ChevronDown size={14} className="text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-400 shrink-0" />
                      )}
                      <button
                        type="button"
                        className="hover:underline text-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMonthClick?.(Number(year), Number(month));
                        }}
                      >
                        {monthName}
                      </button>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">{monthData.total.toFixed(2)}</td>
                </tr>
              );

              if (!isMonthExpanded) return [monthRow];

              const dayRows = sortedDays.map((day) => (
                <tr key={`${monthKey}-${day}`} className="border-b bg-blue-50/20">
                  <td className="px-5 py-3 pl-16 text-gray-300 text-xs">{year}</td>
                  <td className="px-5 py-3 pl-14">
                    <button
                      type="button"
                      className="text-gray-600 hover:underline hover:text-blue-600"
                      onClick={() => onDayClick?.(Number(year), Number(month), Number(day))}
                    >
                      {monthName} {Number(day)}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-700">
                    {monthData.days[day].toFixed(2)}
                  </td>
                </tr>
              ));

              return [monthRow, ...dayRows];
            });

            return [yearRow, ...monthRows];
          })}
        </tbody>
      </table>
    </div>
  );
}
