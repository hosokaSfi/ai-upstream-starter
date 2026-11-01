// スタッフ 145 名・管理者 20 名 + オーナー 1 名(名前はすべて架空の組み合わせ)
import { createRng } from "@/lib/rng";
import { addDays } from "@/lib/date";
import type { AdminUser, PermissionKey, Staff } from "@/lib/types";
import { AREAS, ROOMS, STORES } from "./master";

const SURNAMES = [
  "青葉", "朝倉", "天野", "有村", "五十嵐", "石原", "泉", "市川", "上野", "内田",
  "榎本", "大石", "大塚", "岡野", "小野寺", "柏木", "片桐", "加納", "川島", "神田",
  "菊池", "北原", "久保", "黒田", "小池", "古賀", "桜井", "佐久間", "篠原", "白石",
  "杉浦", "関口", "高瀬", "滝沢", "竹内", "立花", "千葉", "辻", "土屋", "豊田",
  "永井", "中西", "七瀬", "西村", "野村", "浜田", "早瀬", "平野", "広瀬", "藤崎",
  "星野", "堀内", "松岡", "三浦", "水野", "宮坂", "村瀬", "望月", "森下", "柳田",
];
const SURNAME_KANA: Record<string, string> = {
  青葉: "あおば", 朝倉: "あさくら", 天野: "あまの", 有村: "ありむら", 五十嵐: "いがらし", 石原: "いしはら",
  泉: "いずみ", 市川: "いちかわ", 上野: "うえの", 内田: "うちだ", 榎本: "えのもと", 大石: "おおいし",
  大塚: "おおつか", 岡野: "おかの", 小野寺: "おのでら", 柏木: "かしわぎ", 片桐: "かたぎり", 加納: "かのう",
  川島: "かわしま", 神田: "かんだ", 菊池: "きくち", 北原: "きたはら", 久保: "くぼ", 黒田: "くろだ",
  小池: "こいけ", 古賀: "こが", 桜井: "さくらい", 佐久間: "さくま", 篠原: "しのはら", 白石: "しらいし",
  杉浦: "すぎうら", 関口: "せきぐち", 高瀬: "たかせ", 滝沢: "たきざわ", 竹内: "たけうち", 立花: "たちばな",
  千葉: "ちば", 辻: "つじ", 土屋: "つちや", 豊田: "とよだ", 永井: "ながい", 中西: "なかにし",
  七瀬: "ななせ", 西村: "にしむら", 野村: "のむら", 浜田: "はまだ", 早瀬: "はやせ", 平野: "ひらの",
  広瀬: "ひろせ", 藤崎: "ふじさき", 星野: "ほしの", 堀内: "ほりうち", 松岡: "まつおか", 三浦: "みうら",
  水野: "みずの", 宮坂: "みやさか", 村瀬: "むらせ", 望月: "もちづき", 森下: "もりした", 柳田: "やなぎだ",
};
const GIVEN: [string, string][] = [
  ["彩花", "あやか"], ["杏奈", "あんな"], ["愛", "あい"], ["葵", "あおい"], ["明日香", "あすか"],
  ["彩乃", "あやの"], ["一花", "いちか"], ["詩織", "しおり"], ["絵里", "えり"], ["香織", "かおり"],
  ["楓", "かえで"], ["奏", "かなで"], ["夏帆", "かほ"], ["京香", "きょうか"], ["琴音", "ことね"],
  ["咲良", "さくら"], ["沙耶", "さや"], ["静香", "しずか"], ["朱里", "しゅり"], ["涼子", "りょうこ"],
  ["千尋", "ちひろ"], ["奈々", "なな"], ["菜摘", "なつみ"], ["遥", "はるか"], ["瞳", "ひとみ"],
  ["真央", "まお"], ["舞", "まい"], ["美咲", "みさき"], ["美月", "みづき"], ["結衣", "ゆい"],
  ["優花", "ゆうか"], ["由佳", "ゆか"], ["理沙", "りさ"], ["玲奈", "れいな"], ["若菜", "わかな"],
  ["健太", "けんた"], ["翔", "しょう"], ["拓海", "たくみ"], ["大輔", "だいすけ"], ["直樹", "なおき"],
  ["悠真", "ゆうま"], ["亮", "りょう"], ["蓮", "れん"], ["和也", "かずや"], ["智也", "ともや"],
];
const ALIAS = [
  "ミナ", "レイ", "ユナ", "サキ", "リン", "アオ", "ノア", "ココ", "ヒナ", "マユ", "エマ", "ルナ",
  "カノン", "スズ", "ミオ", "ナギ", "ユキ", "ハル", "ソナ", "ミク", "アン", "セナ", "モモ", "ニコ",
];

const STAFF_PER_STORE: Record<string, number> = { st1: 50, st2: 50, st3: 45 };

function buildStaff(): Staff[] {
  const rng = createRng(20261101);
  const list: Staff[] = [];
  const usedNames = new Set<string>();
  for (const store of STORES) {
    const areas = AREAS.filter((a) => a.storeId === store.id);
    const rooms = ROOMS.filter((r) => r.storeId === store.id);
    const fixedPool = [...rooms];
    for (let i = 0; i < STAFF_PER_STORE[store.id]; i++) {
      let surname: string, given: [string, string];
      do {
        surname = rng.pick(SURNAMES);
        given = rng.pick(GIVEN);
      } while (usedNames.has(surname + given[0]));
      usedNames.add(surname + given[0]);
      const id = `${store.id}-s${String(i + 1).padStart(3, "0")}`;
      const homeArea = areas[i % areas.length];
      // 約 1 割が固定部屋持ち(部屋の重複なし)
      let fixedRoomId: string | undefined;
      if (rng.chance(0.13) && fixedPool.length) {
        const idx = fixedPool.findIndex((r) => r.areaId === homeArea.id);
        if (idx >= 0) fixedRoomId = fixedPool.splice(idx, 1)[0].id;
      }
      const aliases = [
        { id: `${id}-al1`, staffId: id, brandId: store.brandIds[0], displayName: rng.pick(ALIAS) },
      ];
      // 約 2 割が別ブランドでも別名義を持つ
      if (rng.chance(0.22)) {
        aliases.push({ id: `${id}-al2`, staffId: id, brandId: store.brandIds[1], displayName: rng.pick(ALIAS) });
      }
      list.push({
        id,
        storeId: store.id,
        name: `${surname} ${given[0]}`,
        kana: `${SURNAME_KANA[surname]} ${given[1]}`,
        aliases,
        homeAreaId: homeArea.id,
        fixedRoomId,
        joinedAt: addDays("2026-11-01", -rng.int(40, 1500)),
        phone: `090-${rng.int(1000, 9999)}-${rng.int(1000, 9999)}`,
        active: true,
      });
    }
  }
  return list;
}

export const STAFF: Staff[] = buildStaff();

export const ALL_PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: "board", label: "配置ボード" },
  { key: "staffList", label: "スタッフ一覧" },
  { key: "score", label: "スコア設定" },
  { key: "alerts", label: "アラート設定" },
  { key: "rooms", label: "部屋管理" },
  { key: "roster", label: "名簿管理" },
  { key: "requests", label: "希望集計" },
  { key: "reports", label: "入退室報告" },
  { key: "notices", label: "お知らせ・罰金" },
  { key: "sheets", label: "スプレッドシート" },
];

function buildAdmins(): AdminUser[] {
  const rng = createRng(777);
  const all = ALL_PERMISSIONS.map((p) => p.key);
  const admins: AdminUser[] = [
    {
      id: "owner",
      name: "本部 オーナー",
      email: "owner@example.com",
      role: "owner",
      storeIds: STORES.map((s) => s.id),
      permissions: all,
      active: true,
    },
  ];
  for (let i = 0; i < 20; i++) {
    const surname = SURNAMES[(i * 7 + 3) % SURNAMES.length];
    const given = GIVEN[(i * 11 + 5) % GIVEN.length];
    const store = STORES[i % 3];
    // 店長クラス(全権限)と、一部の画面だけ使えるリーダー
    const perms: PermissionKey[] =
      i < 6 ? all : all.filter((k) => ["board", "staffList", "requests", "reports", "notices"].includes(k) || rng.chance(0.3));
    admins.push({
      id: `ad${String(i + 1).padStart(2, "0")}`,
      name: `${surname} ${given[0]}`,
      email: `admin${i + 1}@example.com`,
      role: "admin",
      storeIds: i < 3 ? STORES.map((s) => s.id) : [store.id],
      permissions: perms,
      active: i !== 19,
    });
  }
  return admins;
}

export const ADMINS: AdminUser[] = buildAdmins();
