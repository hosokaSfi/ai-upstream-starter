"use client";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ScoreBadge } from "@/components/score-chip";
import { fmtMin, fmtRange, formatDateJa } from "@/lib/date";
import { repo } from "@/lib/repositories";
import type { Assignment, DateStr, ID, Minutes, OpenSlot, Room, Staff, StoreSettings } from "@/lib/types";

function timeOptions(s: StoreSettings, from: Minutes, to: Minutes) {
  const out: Minutes[] = [];
  for (let m = from; m <= to; m += s.slotMinutes) out.push(m);
  return out;
}

export function AssignmentDialog({
  assignment, staff, score, windows, warnings, settings, rooms, onClose,
}: {
  assignment?: Assignment;
  staff?: Staff;
  score?: number;
  windows: { start: Minutes; end: Minutes }[];
  warnings: string[];
  settings: StoreSettings;
  rooms: Room[];
  onClose: () => void;
}) {
  return (
    <Dialog open={!!assignment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {assignment && (
          <AssignmentForm key={assignment.id} a={assignment} staff={staff} score={score} windows={windows} warnings={warnings} settings={settings} rooms={rooms} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssignmentForm({
  a, staff, score, windows, warnings, settings, rooms, onClose,
}: {
  a: Assignment; staff?: Staff; score?: number; windows: { start: Minutes; end: Minutes }[]; warnings: string[]; settings: StoreSettings; rooms: Room[]; onClose: () => void;
}) {
  const [start, setStart] = useState(a.start);
  const [end, setEnd] = useState(a.end);
  const opts = timeOptions(settings, settings.openTime, settings.closeTime);
  const fixed = staff?.fixedRoomId ? rooms.find((r) => r.id === staff.fixedRoomId)?.name : undefined;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {staff?.name ?? a.staffId}
          {score !== undefined && <ScoreBadge score={score} />}
          {a.status === "draft" && <span className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-xs">仮配置</span>}
        </DialogTitle>
        <DialogDescription>
          {formatDateJa(a.date)} / {rooms.find((r) => r.id === a.roomId)?.name}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 text-sm">
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>希望: {windows.length ? windows.map((w) => fmtRange(w.start, w.end)).join(", ") : "なし"}</span>
          {fixed && (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" /> 固定部屋 {fixed}
            </span>
          )}
          {staff && <span>別名義: {staff.aliases.map((x) => x.displayName).join(" / ")}</span>}
        </div>
        {warnings.length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-rose-50 p-2 text-rose-900">
            <AlertTriangle className="mt-0.5 size-4" />
            {warnings.join(" / ")}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>開始</Label>
            <NativeSelect value={start} onChange={(e) => setStart(Number(e.target.value))}>
              {opts.slice(0, -1).map((m) => (
                <option key={m} value={m}>{fmtMin(m)}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>終了</Label>
            <NativeSelect value={end} onChange={(e) => setEnd(Number(e.target.value))}>
              {opts.slice(1).map((m) => (
                <option key={m} value={m}>{fmtMin(m)}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="destructive"
          onClick={() => {
            repo.assignments.remove(a.id);
            onClose();
          }}
        >
          配置から外す
        </Button>
        <Button
          onClick={() => {
            if (end <= start) return toast.error("終了は開始より後にしてください");
            repo.assignments.updateTime(a.id, start, end);
            onClose();
          }}
        >
          時間を保存
        </Button>
      </DialogFooter>
    </>
  );
}

export function OpenSlotDialog({ slot, onClose, roomName }: { slot?: OpenSlot; onClose: () => void; roomName: (id: ID) => string }) {
  return (
    <Dialog open={!!slot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {slot && (
          <>
            <DialogHeader>
              <DialogTitle>空き枠(募集中)</DialogTitle>
              <DialogDescription>
                {formatDateJa(slot.date)} {roomName(slot.roomId)} {fmtRange(slot.start, slot.end)}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm">スタッフアプリの「空き枠」タブに表示中です。早い者順で取得されると自動で配置に入ります。</p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  repo.openSlots.remove(slot.id);
                  onClose();
                }}
              >
                募集を取り下げる
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PublishOpenSlotDialog({
  open, onOpenChange, storeId, date, rooms, settings,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; storeId: ID; date: DateStr; rooms: Room[]; settings: StoreSettings;
}) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [bandId, setBandId] = useState(settings.timeBands[0]?.id ?? "");
  const band = settings.timeBands.find((b) => b.id === bandId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>空き枠を公開</DialogTitle>
          <DialogDescription>{formatDateJa(date)} の空いている枠をスタッフに募集します(早い者順)。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>部屋</Label>
            <NativeSelect value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>時間帯</Label>
            <NativeSelect value={bandId} onChange={(e) => setBandId(e.target.value)}>
              {settings.timeBands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} {fmtRange(b.start, b.end)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (!band || !roomId) return;
              repo.openSlots.publish({ storeId, date, roomId, start: band.start, end: band.end });
              toast.success("空き枠を公開しました");
              onOpenChange(false);
            }}
          >
            公開する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
