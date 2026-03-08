"use client";

import { useState, useEffect, useRef } from "react";
import {
  startOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  format,
  isToday,
  addDays,
  setHours,
  setMinutes,
  differenceInCalendarDays,
} from "date-fns";
import { getAppointmentsForRange } from "@/lib/actions";
import { Appointment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AppointmentFormDialog } from "@/components/AppointmentFormDialog";

// ─── Calendar config ──────────────────────────────────────────
const SLOT_HEIGHT   = 52;   // px per 30-min slot
const START_HOUR    = 7;
const END_HOUR      = 24;
const SIDEBAR_WIDTH = 56;
const TOTAL_DAYS    = 35;   // 5 weeks rendered at once
const WEEKS_BEFORE  = 2;    // weeks to the left of the anchor week
const TIME_SLOTS = Array.from(
  { length: (END_HOUR - START_HOUR) * 2 },
  (_, i) => ({
    hour: START_HOUR + Math.floor(i / 2),
    minute: (i % 2) * 30,
    index: i,
  })
);

const STATUS_STYLES: Record<string, string> = {
  confirmed_package:    "bg-pink-100 border-pink-400 text-pink-900",
  confirmed_no_package: "bg-blue-100 border-blue-400 text-blue-900",
  completed: "bg-emerald-100 border-emerald-400 text-emerald-900",
  cancelled: "bg-gray-100 border-gray-400 text-gray-500 line-through",
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTop(totalMins: number): number {
  return ((totalMins - START_HOUR * 60) / 30) * SLOT_HEIGHT;
}

function apptStyle(appt: Appointment): { top: number; height: number } {
  const start = timeToMinutes(appt.start_time);
  const end   = timeToMinutes(appt.end_time);
  return {
    top:    minutesToTop(start),
    height: Math.max(((end - start) / 30) * SLOT_HEIGHT - 4, SLOT_HEIGHT * 0.6),
  };
}

// ─── Overlap layout ───────────────────────────────────────────
function layoutAppts(appts: Appointment[]): Map<string, { col: number; totalCols: number }> {
  if (appts.length === 0) return new Map();

  const sorted = [...appts].sort((a, b) => {
    const as = timeToMinutes(a.start_time);
    const bs = timeToMinutes(b.start_time);
    return as !== bs ? as - bs : timeToMinutes(b.end_time) - timeToMinutes(a.end_time);
  });

  // Greedy column assignment
  const colEnds: number[] = []; // latest end-minute per column
  const colAssign = new Map<string, number>();
  for (const appt of sorted) {
    const start = timeToMinutes(appt.start_time);
    const end   = timeToMinutes(appt.end_time);
    let placed = false;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= start) {
        colEnds[c] = end;
        colAssign.set(appt.id, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      colAssign.set(appt.id, colEnds.length);
      colEnds.push(end);
    }
  }

  // Cluster overlapping appointments to compute totalCols per group
  const clusterOf = new Map<string, number>();
  const clusters: Set<string>[] = [];
  for (const appt of sorted) {
    const s = timeToMinutes(appt.start_time);
    const e = timeToMinutes(appt.end_time);
    const touched = new Set<number>();
    for (const [otherId, ci] of clusterOf) {
      const o = sorted.find((a) => a.id === otherId)!;
      if (s < timeToMinutes(o.end_time) && timeToMinutes(o.start_time) < e) touched.add(ci);
    }
    if (touched.size === 0) {
      clusterOf.set(appt.id, clusters.length);
      clusters.push(new Set([appt.id]));
    } else {
      const [primary, ...rest] = [...touched];
      clusterOf.set(appt.id, primary);
      clusters[primary].add(appt.id);
      for (const ci of rest) {
        for (const id of clusters[ci]) { clusters[primary].add(id); clusterOf.set(id, primary); }
        clusters[ci].clear();
      }
    }
  }

  const result = new Map<string, { col: number; totalCols: number }>();
  for (const cluster of clusters) {
    if (cluster.size === 0) continue;
    const maxCol = Math.max(...[...cluster].map((id) => colAssign.get(id)!));
    for (const id of cluster) result.set(id, { col: colAssign.get(id)!, totalCols: maxCol + 1 });
  }
  return result;
}

function formatTimeLabel(h: number, m: number): string {
  if (h === 24) return "12:00 AM";
  return format(setMinutes(setHours(new Date(), h), m), "h:mm a");
}

// ─── Dialog state ─────────────────────────────────────────────
type DialogState =
  | { mode: "closed" }
  | { mode: "add"; date: Date; startTime: string }
  | { mode: "edit"; appointment: Appointment };

// ─── Current time indicator ───────────────────────────────────
function CurrentTimeIndicator() {
  const now = new Date();
  const top = minutesToTop(now.getHours() * 60 + now.getMinutes());
  if (top < 0 || top > SLOT_HEIGHT * TIME_SLOTS.length) return null;
  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top }}
    >
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 flex-shrink-0" />
        <div className="flex-1 border-t-2 border-rose-500" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function CalendarClient() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTarget = useRef<'today' | 'week'>('today');
  const [colWidth, setColWidth] = useState(140);

  // Measure scroll container width so exactly 7 columns fit in view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setColWidth(Math.floor((entry.contentRect.width - SIDEBAR_WIDTH) / 7));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Month/year picker state — driven from weekStart
  const currentYear  = weekStart.getFullYear();
  const currentMonth = weekStart.getMonth();
  const [pickerYear, setPickerYear] = useState(currentYear);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function jumpToMonth(year: number, month: number) {
    const target = new Date(year, month, 1);
    scrollTarget.current = 'week';
    setWeekStart(startOfWeek(target, { weekStartsOn: 1 }));
    setPickerOpen(false);
  }

  // rangeStart = WEEKS_BEFORE weeks before the anchor Monday
  const rangeStart = subWeeks(weekStart, WEEKS_BEFORE);
  const allDays = eachDayOfInterval({
    start: rangeStart,
    end: addDays(rangeStart, TOTAL_DAYS - 1),
  });

  // Fetch appointments for the full rendered range
  useEffect(() => {
    const from = format(rangeStart, "yyyy-MM-dd");
    const to   = format(addDays(rangeStart, TOTAL_DAYS - 1), "yyyy-MM-dd");
    setLoading(true);
    getAppointmentsForRange(from, to)
      .then(setAppointments)
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // Scroll horizontally based on intent: today (initial / Today btn) or week start (arrows)
  useEffect(() => {
    if (scrollRef.current && colWidth > 0) {
      const anchor = scrollTarget.current === 'today' ? new Date() : weekStart;
      const idx = differenceInCalendarDays(anchor, rangeStart);
      scrollRef.current.scrollLeft = Math.max(0, idx) * colWidth;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, colWidth]);

  function refresh() {
    const from = format(rangeStart, "yyyy-MM-dd");
    const to   = format(addDays(rangeStart, TOTAL_DAYS - 1), "yyyy-MM-dd");
    getAppointmentsForRange(from, to).then(setAppointments).catch(console.error);
  }

  function handleSlotClick(day: Date, hour: number, minute: number) {
    const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    setDialog({ mode: "add", date: day, startTime });
  }

  function handleApptClick(appt: Appointment, e: React.MouseEvent) {
    e.stopPropagation();
    setDialog({ mode: "edit", appointment: appt });
  }

  function handleDialogClose() {
    setDialog({ mode: "closed" });
    refresh();
  }

  const monthLabel =
    format(weekStart, "MMMM yyyy") ===
    format(addDays(weekStart, 6), "MMMM yyyy")
      ? format(weekStart, "MMMM yyyy")
      : `${format(weekStart, "MMM")} – ${format(addDays(weekStart, 6), "MMM yyyy")}`;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 148px)" }}>

      {/* ── Top controls ──────────────────────────────── */}
      <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Appointments</h1>
        </div>
        {/* Clickable month/year label — centred */}
        <Popover open={pickerOpen} onOpenChange={(v) => { setPickerOpen(v); if (v) setPickerYear(currentYear); }}>
          <PopoverTrigger
            className="flex items-center gap-1 text-gray-900 text-2xl font-bold px-2 py-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer absolute left-1/2 -translate-x-1/2"
          >
            {monthLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="center">
              {/* Year row */}
              <div className="flex items-center justify-between mb-3">
                <button
                  className="p-1 rounded hover:bg-gray-100"
                  onClick={() => setPickerYear(y => y - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold">{pickerYear}</span>
                <button
                  className="p-1 rounded hover:bg-gray-100"
                  onClick={() => setPickerYear(y => y + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {/* Month grid */}
              <div className="grid grid-cols-4 gap-1">
                {MONTHS.map((m, i) => {
                  const isActive = pickerYear === currentYear && i === currentMonth;
                  return (
                    <button
                      key={m}
                      onClick={() => jumpToMonth(pickerYear, i)}
                      className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-pink-500 text-white"
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              scrollTarget.current = 'today';
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => { scrollTarget.current = 'week'; setWeekStart(d => subWeeks(d, 1)); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => { scrollTarget.current = 'week'; setWeekStart(d => addWeeks(d, 1)); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            className="ml-2"
            onClick={() => setDialog({ mode: "add", date: new Date(), startTime: "10:00" })}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* ── Calendar + Legend ─────────────────────────── */}
      <div className="flex-1 flex gap-3 min-h-0">

      {/* Legend */}
      <div className="self-start flex-shrink-0 w-40 border rounded-xl bg-white shadow-sm p-3 flex flex-col gap-2 text-xs">
        <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] mb-1">Legend</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-pink-100 border-l-[3px] border-pink-400" />
          <span className="text-gray-700">Package Customer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-blue-100 border-l-[3px] border-blue-400" />
          <span className="text-gray-700">Walk-in Customer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-emerald-100 border-l-[3px] border-emerald-400" />
          <span className="text-gray-700">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-gray-100 border-l-[3px] border-gray-400" />
          <span className="text-gray-700">Cancelled</span>
        </div>
      </div>

      {/* Calendar container */}
      <div className="flex-1 border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col min-h-0">

        {/* Scrollable in both axes */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          {/* Inner wrapper sized to exact pixel width */}
          <div style={{ width: SIDEBAR_WIDTH + TOTAL_DAYS * colWidth }}>

          {/* Day header row — sticky vertically */}
          <div
            className="border-b bg-white sticky top-0 z-30"
            style={{ display: "grid", gridTemplateColumns: `${SIDEBAR_WIDTH}px repeat(${TOTAL_DAYS}, ${colWidth}px)` }}
          >
            {/* gutter cell — sticky left so it never scrolls away */}
            <div className="border-r bg-gray-50 sticky left-0 z-40" />
            {allDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`py-2.5 text-center border-r last:border-r-0 ${
                  isToday(day) ? "bg-pink-50" : "bg-white"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">
                  {format(day, "EEE")}
                </p>
                <div
                  className={`mx-auto mt-0.5 w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold ${
                    isToday(day)
                      ? "bg-pink-500 text-white"
                      : "text-gray-700"
                  }`}
                >
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-40">
              <span className="text-gray-400 text-sm">Loading…</span>
            </div>
          )}
          <div
            style={{ display: "grid", gridTemplateColumns: `${SIDEBAR_WIDTH}px repeat(${TOTAL_DAYS}, ${colWidth}px)` }}
          >
            {/* Time labels — sticky left */}
            <div className="border-r bg-gray-50 sticky left-0 z-20">
              {TIME_SLOTS.map((slot) => (
                <div
                  key={`t-${slot.index}`}
                  className={`border-b flex items-start justify-end pr-2 pt-1 ${
                    slot.minute === 0 ? "border-gray-100" : "border-gray-300"
                  }`}
                  style={{ height: SLOT_HEIGHT }}
                >
                  {slot.minute === 0 && (
                    <span className="text-[10px] text-gray-400 leading-none">
                      {slot.hour === 24 ? "12 AM" : format(setHours(new Date(), slot.hour), "h a")}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {allDays.map((day) => {
              const dayStr   = format(day, "yyyy-MM-dd");
              const dayAppts = appointments.filter(
                (a) => a.appointment_date === dayStr
              );

              return (
                <div
                  key={day.toISOString()}
                  className={`border-r last:border-r-0 relative ${
                    isToday(day) ? "bg-pink-50/20" : "bg-white"
                  }`}
                  style={{ height: SLOT_HEIGHT * TIME_SLOTS.length }}
                >
                  {/* Clickable slot lines */}
                  {TIME_SLOTS.map((slot) => (
                    <div
                      key={`s-${slot.index}`}
                      className={`absolute left-0 right-0 border-b hover:bg-pink-50/60 cursor-pointer transition-colors ${
                        slot.minute === 0 ? "border-gray-100" : "border-gray-200"
                      }`}
                      style={{
                        top:    slot.index * SLOT_HEIGHT,
                        height: SLOT_HEIGHT,
                      }}
                      onClick={() => handleSlotClick(day, slot.hour, slot.minute)}
                    />
                  ))}

                  {/* Current time indicator */}
                  {isToday(day) && <CurrentTimeIndicator />}

                  {/* Appointment blocks */}
                  {(() => {
                    const layout = layoutAppts(dayAppts);
                    return dayAppts.map((appt) => {
                      const { top, height } = apptStyle(appt);
                      const { col, totalCols } = layout.get(appt.id) ?? { col: 0, totalCols: 1 };
                      const colW   = 100 / totalCols;
                      const leftPct = col * colW;
                      const statusKey =
                        appt.status === "confirmed"
                          ? appt.has_package
                            ? "confirmed_package"
                            : "confirmed_no_package"
                          : appt.status;
                      const colorClass =
                        STATUS_STYLES[statusKey] ?? STATUS_STYLES.confirmed_no_package;
                      return (
                        <div
                          key={appt.id}
                          className={`absolute rounded-md border-l-[3px] px-2 py-1 text-xs cursor-pointer overflow-hidden shadow-sm hover:shadow-md hover:brightness-95 transition-all z-10 ${colorClass}`}
                          style={{
                            top: top + 2,
                            height,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${colW}% - 4px)`,
                          }}
                          title={`${appt.customer_name} — ${appt.service}\n${formatTimeLabel(
                            parseInt(appt.start_time),
                            parseInt(appt.start_time.split(":")[1])
                          )} – ${formatTimeLabel(
                            parseInt(appt.end_time),
                            parseInt(appt.end_time.split(":")[1])
                          )}`}
                          onClick={(e) => handleApptClick(appt, e)}
                        >
                          <p className="font-semibold leading-tight break-words whitespace-normal">
                            {appt.customer_name}
                            <span className="font-normal opacity-70"> ×{appt.num_persons}</span>
                          </p>
                          <p className="leading-tight opacity-80 break-words whitespace-normal">
                            {appt.service}
                          </p>
                          {height >= SLOT_HEIGHT * 1.5 && (
                            <p className="leading-tight opacity-60 tabular-nums">
                              {appt.start_time.slice(0, 5)} – {appt.end_time.slice(0, 5)}
                            </p>
                          )}
                          {appt.notes && height >= SLOT_HEIGHT * 2 && (
                            <p className="leading-tight opacity-50 break-words whitespace-normal mt-0.5">
                              {appt.notes}
                            </p>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              );
            })}
          </div>
          </div>{/* end inner width wrapper */}
        </div>
      </div>
      </div>{/* end calendar + legend row */}

      {/* ── Dialog ────────────────────────────────────── */}
      {dialog.mode !== "closed" && (
        <AppointmentFormDialog
          open
          onClose={handleDialogClose}
          defaultDate={dialog.mode === "add" ? dialog.date : undefined}
          defaultStartTime={dialog.mode === "add" ? dialog.startTime : undefined}
          editingAppointment={dialog.mode === "edit" ? dialog.appointment : undefined}
        />
      )}
    </div>
  );
}
