/** Tile IDs used throughout the app (standard 34 types, no aka for V1). */

export type TileId =
  | "1m" | "2m" | "3m" | "4m" | "5m" | "6m" | "7m" | "8m" | "9m"
  | "1p" | "2p" | "3p" | "4p" | "5p" | "6p" | "7p" | "8p" | "9p"
  | "1s" | "2s" | "3s" | "4s" | "5s" | "6s" | "7s" | "8s" | "9s"
  | "E" | "S" | "W" | "N" | "P" | "F" | "C";

export const TILE_IMAGE: Record<TileId, string> = {
  "1m": "/tiles/Man1.png",
  "2m": "/tiles/Man2.png",
  "3m": "/tiles/Man3.png",
  "4m": "/tiles/Man4.png",
  "5m": "/tiles/Man5.png",
  "6m": "/tiles/Man6.png",
  "7m": "/tiles/Man7.png",
  "8m": "/tiles/Man8.png",
  "9m": "/tiles/Man9.png",
  "1p": "/tiles/Pin1.png",
  "2p": "/tiles/Pin2.png",
  "3p": "/tiles/Pin3.png",
  "4p": "/tiles/Pin4.png",
  "5p": "/tiles/Pin5.png",
  "6p": "/tiles/Pin6.png",
  "7p": "/tiles/Pin7.png",
  "8p": "/tiles/Pin8.png",
  "9p": "/tiles/Pin9.png",
  "1s": "/tiles/Sou1.png",
  "2s": "/tiles/Sou2.png",
  "3s": "/tiles/Sou3.png",
  "4s": "/tiles/Sou4.png",
  "5s": "/tiles/Sou5.png",
  "6s": "/tiles/Sou6.png",
  "7s": "/tiles/Sou7.png",
  "8s": "/tiles/Sou8.png",
  "9s": "/tiles/Sou9.png",
  E: "/tiles/Ton.png",
  S: "/tiles/Nan.png",
  W: "/tiles/Shaa.png",
  N: "/tiles/Pei.png",
  P: "/tiles/Haku.png",
  F: "/tiles/Hatsu.png",
  C: "/tiles/Chun.png",
};

export const TILE_NAME_JA: Record<TileId, string> = {
  "1m": "一萬",
  "2m": "二萬",
  "3m": "三萬",
  "4m": "四萬",
  "5m": "五萬",
  "6m": "六萬",
  "7m": "七萬",
  "8m": "八萬",
  "9m": "九萬",
  "1p": "一筒",
  "2p": "二筒",
  "3p": "三筒",
  "4p": "四筒",
  "5p": "五筒",
  "6p": "六筒",
  "7p": "七筒",
  "8p": "八筒",
  "9p": "九筒",
  "1s": "一索",
  "2s": "二索",
  "3s": "三索",
  "4s": "四索",
  "5s": "五索",
  "6s": "六索",
  "7s": "七索",
  "8s": "八索",
  "9s": "九索",
  E: "東",
  S: "南",
  W: "西",
  N: "北",
  P: "白",
  F: "發",
  C: "中",
};

export const ALL_TILE_IDS: TileId[] = Object.keys(TILE_IMAGE) as TileId[];

/** Full wall: 4 of each of 34 types = 136. */
export function buildWall(): TileId[] {
  const wall: TileId[] = [];
  for (const id of ALL_TILE_IDS) {
    for (let i = 0; i < 4; i++) wall.push(id);
  }
  return wall;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deal a 14-tile hand (13 + tsumo) from a shuffled wall. */
export function dealHand14(): TileId[] {
  return shuffle(buildWall()).slice(0, 14);
}

export function sortHand(hand: TileId[]): TileId[] {
  const order = new Map(ALL_TILE_IDS.map((id, i) => [id, i]));
  return [...hand].sort((a, b) => (order.get(a)! - order.get(b)!));
}

export function isTileId(v: string): v is TileId {
  return v in TILE_IMAGE;
}
