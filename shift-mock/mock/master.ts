// 店舗・ブランド・エリア・部屋のダミーマスタ
import type { Area, Brand, ChecklistItem, PhotoSpot, Room, Store, StoreSettings, TimeBand } from "@/lib/types";

export const BRANDS: Brand[] = [
  { id: "b1", name: "ルミエ" },
  { id: "b2", name: "カーム" },
  { id: "b3", name: "ソラ" },
];

const bands = (close: number): TimeBand[] => [
  { id: "early", label: "早番", start: 600, end: 900 },
  { id: "middle", label: "中番", start: 840, end: 1140 },
  { id: "late", label: "遅番", start: 1080, end: close },
];

const settings = (over: Partial<StoreSettings> & { closeTime: number }): StoreSettings => ({
  openTime: 600,
  slotMinutes: 30,
  submissionDeadlineDay: 20,
  roomSwapIntervalMinutes: 30,
  timeBands: bands(over.closeTime),
  ...over,
});

export const STORES: Store[] = [
  { id: "st1", name: "中央店", brandIds: ["b1", "b2"], settings: settings({ closeTime: 1440 }) },
  { id: "st2", name: "駅前店", brandIds: ["b1", "b3"], settings: settings({ closeTime: 1380 }) },
  {
    id: "st3",
    name: "北口店",
    brandIds: ["b2", "b3"],
    settings: settings({ closeTime: 1320, slotMinutes: 60, submissionDeadlineDay: 15, roomSwapIntervalMinutes: 60 }),
  },
];

/** 部屋の標準チェック項目と撮影箇所(部屋管理画面で増減できる) */
export function defaultChecklist(prefix: string): ChecklistItem[] {
  return [
    { id: `${prefix}-c1`, label: "タオル類の補充", kind: "equipment" },
    { id: `${prefix}-c2`, label: "アメニティの補充", kind: "equipment" },
    { id: `${prefix}-c3`, label: "備品の破損・不足なし", kind: "equipment" },
    { id: `${prefix}-c4`, label: "床の清掃", kind: "cleaning" },
    { id: `${prefix}-c5`, label: "水回りの清掃", kind: "cleaning" },
    { id: `${prefix}-c6`, label: "ベッドメイク", kind: "cleaning" },
    { id: `${prefix}-c7`, label: "ゴミの回収", kind: "cleaning" },
  ];
}

export function defaultPhotoSpots(prefix: string): PhotoSpot[] {
  return [
    { id: `${prefix}-p1`, label: "入口", count: 1 },
    { id: `${prefix}-p2`, label: "ベッド周り", count: 2 },
    { id: `${prefix}-p3`, label: "水回り", count: 1 },
  ];
}

const AREA_DEF: Record<string, { name: string; rooms: number }[]> = {
  st1: [
    { name: "Aエリア(1F)", rooms: 4 },
    { name: "Bエリア(2F)", rooms: 4 },
    { name: "Cエリア(別館)", rooms: 3 },
  ],
  st2: [
    { name: "Aエリア(1F)", rooms: 5 },
    { name: "Bエリア(2F)", rooms: 5 },
  ],
  st3: [
    { name: "Aエリア", rooms: 3 },
    { name: "Bエリア", rooms: 3 },
    { name: "Cエリア", rooms: 3 },
  ],
};

export const AREAS: Area[] = [];
export const ROOMS: Room[] = [];

for (const store of STORES) {
  AREA_DEF[store.id].forEach((a, ai) => {
    const areaId = `${store.id}-a${ai + 1}`;
    AREAS.push({ id: areaId, storeId: store.id, name: a.name, order: ai });
    for (let r = 0; r < a.rooms; r++) {
      const id = `${areaId}-r${r + 1}`;
      const isAnnex = a.name.includes("別館");
      ROOMS.push({
        id,
        storeId: store.id,
        areaId,
        name: isAnnex ? `別館${r + 1}` : `${ai + 1}0${r + 1}`,
        order: r,
        checklist: defaultChecklist(id),
        photoSpots: defaultPhotoSpots(id),
      });
    }
  });
}
