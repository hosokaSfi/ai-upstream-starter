"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Lock, Maximize2, Megaphone, Minimize2, Search, Trash2, Wand2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScoreLegend } from "@/components/score-chip";
import { autoAssign } from "@/lib/autoAssign";
import { addDays, fmtMin, fmtRange, formatDateJa, monthOf, todayStr } from "@/lib/date";
import { useCurrentStore, useMetrics, useStoreAreasRooms, useStoreStaff } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { windowsForDate } from "@/lib/requests";
import { scoreBand, SCORE_BAND_STYLE } from "@/lib/score";
import { useData } from "@/lib/store";
import type { Assignment, ID, Minutes, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { computeWarnings, layoutLanes, WARNING_LABEL, type RowItem } from "./board-model";
import { AssignmentDialog, OpenSlotDialog, PublishOpenSlotDialog } from "./board-dialogs";

const LANE_H = 30;
const LABEL_W = 92;

type DragData = { type: "palette"; staffId: ID } | { type: "chip"; id: ID; offsetSlots: number };

export function PlacementBoard() {
  const store = useCurrentStore();
  const { openTime, closeTime, slotMinutes, roomSwapIntervalMinutes, timeBands } = store.settings;
  const [date, setDate] = useState(todayStr());
  const [full, setFull] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [drag, setDrag] = useState<DragData | null>(null);
  const [editing, setEditing] = useState<ID | null>(null);
  const [editingOpen, setEditingOpen] = useState<ID | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const groups = useStoreAreasRooms(store.id);
  const allAssignments = useData((d) => d.assignments);
  const allOpenSlots = useData((d) => d.openSlots);
  const requests = useData((d) => d.requests);
  const absences = useData((d) => d.absences);
  const staffList = useStoreStaff(store.id);
  const metrics = useMetrics("6m");

  const slotCount = Math.ceil((closeTime - openTime) / slotMinutes);
  const slotPx = slotMinutes === 30 ? 34 : 60;
  const gridW = slotCount * slotPx;
  const pct = (m: Minutes) => ((m - openTime) / (closeTime - openTime)) * 100;

  const staffById = useMemo(() => new Map(staffList.map((s) => [s.id, s])), [staffList]);
  const dayAssignments = useMemo(
    () => allAssignments.filter((a) => a.storeId === store.id && a.date === date),
    [allAssignments, store.id, date],
  );
  const dayOpenSlots = useMemo(
    () => allOpenSlots.filter((o) => o.storeId === store.id && o.date === date && !o.takenBy),
    [allOpenSlots, store.id, date],
  );
  const dayAbsences = useMemo(
    () => absences.filter((a) => a.storeId === store.id && a.date === date),
    [absences, store.id, date],
  );
  const absentIds = useMemo(() => new Set(dayAbsences.map((a) => a.staffId)), [dayAbsences]);

  const windowsOf = useMemo(() => {
    const month = monthOf(date);
    const byStaff = new Map(requests.filter((r) => r.month === month).map((r) => [r.staffId, r]));
    const map = new Map(staffList.map((s) => [s.id, windowsForDate(byStaff.get(s.id), date, timeBands)]));
    return (staffId: ID) => map.get(staffId) ?? [];
  }, [requests, date, timeBands, staffList]);

  const warnings = useMemo(
    () => computeWarnings(dayAssignments, roomSwapIntervalMinutes, windowsOf),
    [dayAssignments, roomSwapIntervalMinutes, windowsOf],
  );

  const placedIds = useMemo(() => new Set(dayAssignments.map((a) => a.staffId)), [dayAssignments]);
  const drafts = dayAssignments.filter((a) => a.status === "draft");

  // パレット(この日の出勤希望者、または全スタッフ)
  const palette = useMemo(() => {
    const q = query.trim();
    return staffList
      .filter((s) => showAll || windowsOf(s.id).length > 0)
      .filter((s) => !q || s.name.includes(q) || s.kana.includes(q) || s.aliases.some((a) => a.displayName.includes(q)))
      .sort(
        (a, b) =>
          Number(placedIds.has(a.id)) - Number(placedIds.has(b.id)) ||
          (metrics.get(b.id)?.score ?? 0) - (metrics.get(a.id)?.score ?? 0),
      );
  }, [staffList, showAll, query, windowsOf, placedIds, metrics]);
  const requestedCount = staffList.filter((s) => windowsOf(s.id).length > 0).length;

  // 全画面表示
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFull = () => {
    if (!full) {
      setFull(true);
      boardRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      setFull(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as DragData;
    if (d.type === "chip") {
      const a = dayAssignments.find((x) => x.id === d.id);
      const rect = e.active.rect.current.initial;
      const ev = e.activatorEvent as PointerEvent & TouchEvent;
      const clientX = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0;
      if (a && rect) {
        const perSlot = rect.width / Math.max(1, (a.end - a.start) / slotMinutes);
        setDrag({ ...d, offsetSlots: Math.max(0, Math.floor((clientX - rect.left) / perSlot)) });
        return;
      }
    }
    setDrag(d);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const d = drag;
    setDrag(null);
    if (!d || !e.over) return;
    const overId = String(e.over.id);
    if (overId === "palette") {
      if (d.type === "chip") repo.assignments.remove(d.id);
      return;
    }
    const [, roomId, idxStr] = overId.split("|");
    const idx = Number(idxStr);
    if (d.type === "palette") {
      const start = openTime + idx * slotMinutes;
      const w = windowsOf(d.staffId).find((x) => x.start <= start && start < x.end);
      const end = Math.min(closeTime, w ? w.end : start + 240);
      if (absentIds.has(d.staffId)) toast.warning("このスタッフはこの日に休みの報告をしています");
      repo.assignments.create({ storeId: store.id, date, roomId, staffId: d.staffId, start, end, status: "confirmed" });
    } else {
      const a = dayAssignments.find((x) => x.id === d.id);
      if (!a) return;
      const len = a.end - a.start;
      let start = openTime + (idx - d.offsetSlots) * slotMinutes;
      start = Math.max(openTime, Math.min(start, closeTime - len));
      if (start !== a.start || roomId !== a.roomId) repo.assignments.move(a.id, roomId, start);
    }
  };

  const runAuto = () => {
    const rooms = groups.flatMap((g) => g.rooms.map((r) => ({ id: r.id, areaId: r.areaId, areaOrder: g.area.order, order: r.order })));
    const candidates = staffList
      .filter((s) => !absentIds.has(s.id))
      .flatMap((s) =>
        windowsOf(s.id).map((w) => ({
          staffId: s.id,
          score: metrics.get(s.id)?.score ?? 5,
          homeAreaId: s.homeAreaId,
          fixedRoomId: s.fixedRoomId,
          ...w,
        })),
      );
    const existing = [
      ...dayAssignments.filter((a) => a.status === "confirmed"),
      ...dayOpenSlots.map((o) => ({ ...o, staffId: `open:${o.id}` })),
    ].map((a) => ({ staffId: a.staffId, roomId: a.roomId, start: a.start, end: a.end }));
    const res = autoAssign({ rooms, candidates, existing, intervalMinutes: roomSwapIntervalMinutes, open: openTime, close: closeTime });
    repo.assignments.replaceDrafts(store.id, date, res.placements);
    const noRoom = new Set(res.unassigned.filter((u) => u.reason === "no_room").map((u) => u.staffId)).size;
    toast.success(`仮配置 ${res.placements.length}件を作成しました`, {
      description: noRoom ? `部屋が足りず未配置: ${noRoom}名(左の一覧に残っています)` : "希望者は全員配置できました",
    });
  };

  const dragAssignment = drag?.type === "chip" ? dayAssignments.find((a) => a.id === drag.id) : undefined;
  const dragStaff = drag?.type === "palette" ? staffById.get(drag.staffId) : dragAssignment ? staffById.get(dragAssignment.staffId) : undefined;

  return (
    <div ref={boardRef} className={cn("flex flex-col gap-3", full && "bg-background fixed inset-0 z-50 overflow-auto p-3")}>
      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="前日" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft />
          </Button>
          <label className="border-input relative flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold">
            <CalendarDays className="text-muted-foreground size-4" />
            {formatDateJa(date)}
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="日付を選択"
            />
          </label>
          <Button variant="outline" size="icon" aria-label="翌日" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(todayStr())}>
            今日
          </Button>
        </div>
        <div className="flex-1" />
        <Button onClick={runAuto}>
          <Wand2 /> 自動仮組み
        </Button>
        {drafts.length > 0 && (
          <>
            <Button
              variant="secondary"
              className="border-primary/40 border"
              onClick={() => {
                const n = repo.assignments.confirmDrafts(store.id, date);
                toast.success(`${n}件を確定しました`);
              }}
            >
              <Check /> 確定({drafts.length})
            </Button>
            <Button variant="ghost" onClick={() => repo.assignments.discardDrafts(store.id, date)}>
              <X /> 仮配置を破棄
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => setPublishOpen(true)}>
          <Megaphone /> 空き枠を公開
        </Button>
        <Button variant="outline" size="icon" onClick={toggleFull} aria-label={full ? "全画面を終了" : "全画面表示"}>
          {full ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <ScoreLegend />
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <span className="border-primary/60 inline-block h-3 w-5 rounded-sm border border-dashed" style={draftStyle} /> 仮配置
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-slate-400 bg-white" /> 空き枠(募集中)
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <AlertTriangle className="size-3 text-rose-600" /> 要確認
        </span>
      </div>

      {dayAbsences.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          <AlertTriangle className="size-4" /> 急な休みの報告:
          {dayAbsences.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1">
              <b>{staffById.get(a.staffId)?.name ?? a.staffId}</b>({a.reason})
              {!a.acknowledged && (
                <Button size="sm" variant="outline" className="h-7 bg-white" onClick={() => repo.absences.acknowledge(a.id)}>
                  確認済にする
                </Button>
              )}
            </span>
          ))}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
        <div className="flex min-h-0 flex-col gap-3 xl:flex-row">
          {/* スタッフパレット */}
          <Palette
            staff={palette}
            requestedCount={requestedCount}
            showAll={showAll}
            setShowAll={setShowAll}
            query={query}
            setQuery={setQuery}
            placedIds={placedIds}
            absentIds={absentIds}
            windowsOf={windowsOf}
            scoreOf={(id) => metrics.get(id)?.score ?? 5}
            roomName={(id) => groups.flatMap((g) => g.rooms).find((r) => r.id === id)?.name}
            dragging={drag?.type === "chip"}
          />

          {/* ボード本体 */}
          <div className="bg-card min-w-0 flex-1 overflow-x-auto rounded-xl border">
            <div style={{ minWidth: gridW + LABEL_W }} className="relative text-xs">
              {/* 時間ヘッダー */}
              <div className="bg-card sticky top-0 z-20 flex border-b">
                <div className="bg-card sticky left-0 z-10 shrink-0 border-r px-2 py-1.5 font-semibold" style={{ width: LABEL_W }}>
                  部屋 \ 時間
                </div>
                <div className="relative h-7 flex-1">
                  {Array.from({ length: slotCount }, (_, i) => {
                    const m = openTime + i * slotMinutes;
                    return m % 60 === 0 ? (
                      <span key={i} className="text-muted-foreground absolute top-1.5 pl-1 tabular-nums" style={{ left: `${(i / slotCount) * 100}%` }}>
                        {fmtMin(m)}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {groups.map(({ area, rooms }) => (
                <div key={area.id}>
                  <div className="bg-muted/70 border-b px-2 py-1 text-[11px] font-semibold">
                    {area.name}
                  </div>
                  {rooms.map((room) => {
                    const items: RowItem[] = [
                      ...dayAssignments.filter((a) => a.roomId === room.id).map((a) => ({ kind: "assignment" as const, a })),
                      ...dayOpenSlots.filter((o) => o.roomId === room.id).map((o) => ({ kind: "open" as const, o })),
                    ];
                    const laid = layoutLanes(items);
                    const lanes = Math.max(1, ...laid.map((l) => l.lane + 1));
                    return (
                      <div key={room.id} className="flex border-b last:border-b-0">
                        <div className="bg-card sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r px-2 font-medium" style={{ width: LABEL_W }}>
                          {room.name}
                          {staffList.some((s) => s.fixedRoomId === room.id) && <Lock className="text-muted-foreground size-3" aria-label="固定部屋あり" />}
                        </div>
                        <div className="relative flex-1" style={{ height: lanes * LANE_H + 6 }}>
                          <div className="absolute inset-0 flex">
                            {Array.from({ length: slotCount }, (_, i) => (
                              <Cell key={i} id={`cell|${room.id}|${i}`} hour={(openTime + i * slotMinutes) % 60 === 0} />
                            ))}
                          </div>
                          {laid.map(({ item, lane }) =>
                            item.kind === "assignment" ? (
                              <Chip
                                key={item.a.id}
                                a={item.a}
                                staff={staffById.get(item.a.staffId)}
                                score={metrics.get(item.a.staffId)?.score ?? 5}
                                warn={[...(warnings.get(item.a.id) ?? []).map((w) => WARNING_LABEL[w]), ...(absentIds.has(item.a.staffId) ? ["休み報告あり"] : [])]}
                                left={pct(item.a.start)}
                                width={pct(item.a.end) - pct(item.a.start)}
                                top={lane * LANE_H + 3}
                                hidden={drag?.type === "chip" && drag.id === item.a.id}
                                onClick={() => setEditing(item.a.id)}
                              />
                            ) : (
                              <button
                                key={item.o.id}
                                className="absolute flex items-center justify-center overflow-hidden rounded border border-dashed border-slate-400 bg-white/80 px-1 text-[11px] whitespace-nowrap text-slate-600"
                                style={{ left: `${pct(item.o.start)}%`, width: `${pct(item.o.end) - pct(item.o.start)}%`, top: lane * LANE_H + 3, height: LANE_H - 4 }}
                                onClick={() => setEditingOpen(item.o.id)}
                              >
                                空き枠 募集中 {fmtRange(item.o.start, item.o.end)}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragStaff ? (
            <div
              className={cn("flex h-7 items-center gap-1 rounded border px-2 text-xs font-medium shadow-lg", SCORE_BAND_STYLE[scoreBand(metrics.get(dragStaff.id)?.score ?? 5)].chip)}
              style={dragAssignment ? { width: ((dragAssignment.end - dragAssignment.start) / slotMinutes) * slotPx } : undefined}
            >
              {dragStaff.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AssignmentDialog
        assignment={dayAssignments.find((a) => a.id === editing)}
        onClose={() => setEditing(null)}
        staff={editing ? staffById.get(dayAssignments.find((a) => a.id === editing)?.staffId ?? "") : undefined}
        score={metrics.get(dayAssignments.find((a) => a.id === editing)?.staffId ?? "")?.score}
        windows={editing ? windowsOf(dayAssignments.find((a) => a.id === editing)?.staffId ?? "") : []}
        warnings={(warnings.get(editing ?? "") ?? []).map((w) => WARNING_LABEL[w])}
        settings={store.settings}
        rooms={groups.flatMap((g) => g.rooms)}
      />
      <OpenSlotDialog slot={dayOpenSlots.find((o) => o.id === editingOpen)} onClose={() => setEditingOpen(null)} roomName={(id) => groups.flatMap((g) => g.rooms).find((r) => r.id === id)?.name ?? ""} />
      <PublishOpenSlotDialog open={publishOpen} onOpenChange={setPublishOpen} storeId={store.id} date={date} rooms={groups.flatMap((g) => g.rooms)} settings={store.settings} />
    </div>
  );
}

const draftStyle: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.75) 0 4px, transparent 4px 8px)",
};

function Cell({ id, hour }: { id: string; hour: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={cn("h-full min-w-0 flex-1 border-l", hour ? "border-slate-200" : "border-slate-100", isOver && "bg-primary/15")} />;
}

function Chip({
  a, staff, score, warn, left, width, top, hidden, onClick,
}: {
  a: Assignment; staff?: Staff; score: number; warn: string[]; left: number; width: number; top: number; hidden: boolean; onClick: () => void;
}) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `chip:${a.id}`, data: { type: "chip", id: a.id, offsetSlots: 0 } satisfies DragData });
  const band = SCORE_BAND_STYLE[scoreBand(score)];
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      title={`${staff?.name ?? a.staffId} ${fmtRange(a.start, a.end)} スコア${score.toFixed(1)}${a.status === "draft" ? "(仮配置)" : ""}${warn.length ? `\n⚠ ${warn.join(" / ")}` : ""}`}
      className={cn(
        "absolute flex touch-none items-center gap-1 overflow-hidden rounded border px-1.5 text-left text-[11px] leading-tight font-medium whitespace-nowrap shadow-xs",
        band.chip,
        a.status === "draft" && "border-primary/70 border-dashed",
        warn.length > 0 && "ring-2 ring-rose-500/70",
        hidden && "opacity-30",
      )}
      style={{ left: `${left}%`, width: `${width}%`, top, height: LANE_H - 4, ...(a.status === "draft" ? draftStyle : {}) }}
    >
      {a.status === "draft" && <span className="bg-primary text-primary-foreground rounded px-0.5 text-[9px]">仮</span>}
      {warn.length > 0 && <AlertTriangle className="size-3 shrink-0 text-rose-600" />}
      <span className="truncate">{staff?.name.split(" ")[0] ?? "?"}</span>
      <span className="tabular-nums opacity-70">{score.toFixed(1)}</span>
      <span className="ml-auto tabular-nums opacity-60">{fmtRange(a.start, a.end)}</span>
    </button>
  );
}

function Palette(props: {
  staff: Staff[];
  requestedCount: number;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  query: string;
  setQuery: (v: string) => void;
  placedIds: Set<ID>;
  absentIds: Set<ID>;
  windowsOf: (id: ID) => { start: Minutes; end: Minutes }[];
  scoreOf: (id: ID) => number;
  roomName: (id: ID) => string | undefined;
  dragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "palette" });
  const unplaced = props.staff.filter((s) => !props.placedIds.has(s.id) && props.windowsOf(s.id).length > 0).length;
  return (
    <aside
      ref={setNodeRef}
      className={cn(
        "bg-card flex shrink-0 flex-col gap-2 rounded-xl border p-2 xl:w-64",
        props.dragging && "border-rose-300 border-dashed",
        isOver && "bg-rose-50",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="text-sm font-semibold">
          出勤希望 {props.requestedCount}名
          {unplaced > 0 && <Badge variant="warning" className="ml-1">未配置 {unplaced}</Badge>}
        </div>
        <Label className="text-muted-foreground text-xs whitespace-nowrap">
          全員
          <Switch checked={props.showAll} onCheckedChange={props.setShowAll} aria-label="全スタッフを表示" />
        </Label>
      </div>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <Input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="名前・別名義で検索" className="pl-8" />
      </div>
      {props.dragging && (
        <div className="flex items-center justify-center gap-1 rounded-md border border-dashed border-rose-300 py-2 text-xs text-rose-700">
          <Trash2 className="size-3.5" /> ここにドロップで配置から外す
        </div>
      )}
      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto xl:max-h-[calc(100dvh-260px)] xl:flex-col xl:flex-nowrap">
        {props.staff.map((s) => (
          <PaletteChip
            key={s.id}
            staff={s}
            score={props.scoreOf(s.id)}
            placed={props.placedIds.has(s.id)}
            absent={props.absentIds.has(s.id)}
            windows={props.windowsOf(s.id)}
            fixedRoom={s.fixedRoomId ? props.roomName(s.fixedRoomId) : undefined}
          />
        ))}
        {props.staff.length === 0 && <p className="text-muted-foreground p-2 text-xs">該当するスタッフがいません</p>}
      </div>
      <p className="text-muted-foreground px-1 text-[11px]">ドラッグして部屋×時間に配置。チップをタップで時間変更・外す。</p>
    </aside>
  );
}

function PaletteChip({ staff, score, placed, absent, windows, fixedRoom }: { staff: Staff; score: number; placed: boolean; absent: boolean; windows: { start: Minutes; end: Minutes }[]; fixedRoom?: string }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `p:${staff.id}`, data: { type: "palette", staffId: staff.id } satisfies DragData });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex min-h-9 cursor-grab touch-none items-center gap-1.5 rounded-md border px-2 py-1 text-xs select-none",
        SCORE_BAND_STYLE[scoreBand(score)].chip,
        placed && "opacity-45",
        isDragging && "opacity-30",
      )}
    >
      <span className="font-medium">{staff.name}</span>
      <span className="tabular-nums opacity-75">{score.toFixed(1)}</span>
      {fixedRoom && (
        <span className="inline-flex items-center gap-0.5 rounded bg-white/70 px-1 text-[10px]">
          <Lock className="size-2.5" />
          {fixedRoom}
        </span>
      )}
      {absent && <span className="rounded bg-rose-600 px-1 text-[10px] text-white">休</span>}
      <span className="ml-auto text-[10px] tabular-nums opacity-70">{windows.map((w) => fmtRange(w.start, w.end)).join(", ") || "希望なし"}</span>
      {placed && <Check className="size-3" />}
    </div>
  );
}

