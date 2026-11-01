"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Camera, ListChecks, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useCurrentStore, useStoreAreasRooms } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import type { ChecklistKind, ID, Room } from "@/lib/types";
import { cn } from "@/lib/utils";

const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export default function RoomsPage() {
  return (
    <PermissionGate perm="rooms">
      <Rooms />
    </PermissionGate>
  );
}

function Rooms() {
  const store = useCurrentStore();
  const groups = useStoreAreasRooms(store.id);
  const allRooms = groups.flatMap((g) => g.rooms);
  const [selected, setSelected] = useState<ID | null>(null);
  const room = allRooms.find((r) => r.id === selected) ?? allRooms[0];
  const [newArea, setNewArea] = useState("");

  return (
    <div>
      <PageHeader title="部屋管理" description="エリアと部屋、部屋ごとの備品・清掃チェック項目、入退室報告の撮影箇所と枚数を設定します。" />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">エリア・部屋</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {groups.map(({ area, rooms }) => (
              <AreaBlock key={area.id} areaId={area.id} name={area.name} rooms={rooms} selected={room?.id} onSelect={setSelected} storeId={store.id} />
            ))}
            <form
              className="flex gap-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newArea.trim()) return;
                repo.rooms.addArea(store.id, newArea.trim());
                setNewArea("");
              }}
            >
              <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="新しいエリア名(例: Dエリア 3F)" />
              <Button type="submit" variant="outline"><Plus /> エリア登録</Button>
            </form>
          </CardContent>
        </Card>

        {room ? <RoomEditor key={room.id} room={room} areas={groups.map((g) => g.area)} /> : <p className="text-muted-foreground text-sm">部屋を追加してください</p>}
      </div>
    </div>
  );
}

function AreaBlock({ areaId, name, rooms, selected, onSelect, storeId }: { areaId: ID; name: string; rooms: Room[]; selected?: ID; onSelect: (id: ID) => void; storeId: ID }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {editing ? (
          <form className="flex flex-1 gap-1" onSubmit={(e) => { e.preventDefault(); repo.rooms.renameArea(areaId, val); setEditing(false); }}>
            <Input value={val} onChange={(e) => setVal(e.target.value)} className="h-8" autoFocus />
            <Button size="sm" type="submit">保存</Button>
          </form>
        ) : (
          <>
            <span className="flex-1 text-sm font-semibold">{name}</span>
            <Button variant="ghost" size="icon" className="size-8" aria-label="エリア名を変更" onClick={() => setEditing(true)}><Pencil /></Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="エリアを削除"
              onClick={() => { if (!repo.rooms.removeArea(areaId)) toast.error("部屋が残っているエリアは削除できません"); }}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {rooms.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={cn("min-h-10 min-w-14 rounded-md border px-2 text-sm", selected === r.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {r.name}
          </button>
        ))}
        <button
          className="text-muted-foreground hover:bg-accent min-h-10 rounded-md border border-dashed px-2 text-sm"
          onClick={() => repo.rooms.addRoom(storeId, areaId, `新規${rooms.length + 1}`)}
        >
          + 部屋
        </button>
      </div>
    </div>
  );
}

function RoomEditor({ room, areas }: { room: Room; areas: { id: ID; name: string }[] }) {
  const [name, setName] = useState(room.name);
  const [newItem, setNewItem] = useState("");
  const [newKind, setNewKind] = useState<ChecklistKind>("cleaning");
  const [newSpot, setNewSpot] = useState("");
  const totalPhotos = room.photoSpots.reduce((a, p) => a + p.count, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">部屋の基本情報</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>部屋名</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== room.name && repo.rooms.updateRoom(room.id, { name })} className="w-40" />
          </div>
          <div className="grid gap-1.5">
            <Label>エリア</Label>
            <NativeSelect value={room.areaId} onChange={(e) => repo.rooms.updateRoom(room.id, { areaId: e.target.value })} className="w-48">
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex-1" />
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => { if (confirm(`${room.name} を削除します。配置も削除されます。`)) repo.rooms.removeRoom(room.id); }}
          >
            <Trash2 /> 部屋を削除
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="size-4" /> 備品・清掃チェック項目</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {room.checklist.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <Badge variant={c.kind === "equipment" ? "secondary" : "outline"} className="w-12 justify-center">{c.kind === "equipment" ? "備品" : "清掃"}</Badge>
                <Input
                  defaultValue={c.label}
                  onBlur={(e) => e.target.value !== c.label && repo.rooms.updateRoom(room.id, { checklist: room.checklist.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) })}
                  className="h-9"
                />
                <Button variant="ghost" size="icon" aria-label="項目を削除" onClick={() => repo.rooms.updateRoom(room.id, { checklist: room.checklist.filter((x) => x.id !== c.id) })}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <form
              className="mt-2 flex gap-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newItem.trim()) return;
                repo.rooms.updateRoom(room.id, { checklist: [...room.checklist, { id: newId(room.id), label: newItem.trim(), kind: newKind }] });
                setNewItem("");
              }}
            >
              <NativeSelect value={newKind} onChange={(e) => setNewKind(e.target.value as ChecklistKind)} className="w-24 shrink-0">
                <option value="equipment">備品</option>
                <option value="cleaning">清掃</option>
              </NativeSelect>
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="項目名" />
              <Button type="submit" variant="outline"><Plus /> 追加</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Camera className="size-4" /> 撮影箇所と枚数 <Badge variant="secondary">計{totalPhotos}枚</Badge></CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {room.photoSpots.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Input
                  defaultValue={p.label}
                  onBlur={(e) => e.target.value !== p.label && repo.rooms.updateRoom(room.id, { photoSpots: room.photoSpots.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)) })}
                  className="h-9"
                />
                <div className="flex items-center rounded-md border">
                  <Button variant="ghost" size="icon" aria-label="枚数を減らす" disabled={p.count <= 1} onClick={() => repo.rooms.updateRoom(room.id, { photoSpots: room.photoSpots.map((x) => (x.id === p.id ? { ...x, count: x.count - 1 } : x)) })}>
                    <Minus />
                  </Button>
                  <span className="w-10 text-center text-sm tabular-nums">{p.count}枚</span>
                  <Button variant="ghost" size="icon" aria-label="枚数を増やす" onClick={() => repo.rooms.updateRoom(room.id, { photoSpots: room.photoSpots.map((x) => (x.id === p.id ? { ...x, count: x.count + 1 } : x)) })}>
                    <Plus />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" aria-label="撮影箇所を削除" onClick={() => repo.rooms.updateRoom(room.id, { photoSpots: room.photoSpots.filter((x) => x.id !== p.id) })}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <form
              className="mt-2 flex gap-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSpot.trim()) return;
                repo.rooms.updateRoom(room.id, { photoSpots: [...room.photoSpots, { id: newId(room.id), label: newSpot.trim(), count: 1 }] });
                setNewSpot("");
              }}
            >
              <Input value={newSpot} onChange={(e) => setNewSpot(e.target.value)} placeholder="撮影箇所(例: 鏡・洗面台)" />
              <Button type="submit" variant="outline"><Plus /> 追加</Button>
            </form>
            <p className="text-muted-foreground text-xs">スタッフの入退室報告は、この順番・枚数で撮影ガイドが表示されます。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
