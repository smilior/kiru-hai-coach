# 切る牌コーチ（Kiru Hai Coach）

1人用の麻雀コーチ。14枚の手牌から「切る牌」を [Jev](https://vercel.com/ai-gateway/models/jev)（`typesafe-ai/jev`）が判定し、効率・安全・待ちのスコアから日本語で解説します。

## Done means（V1）

1. 手牌14枚 → Jev が1枚を推奨、日本語解説（効率 / 安全 / 待ち）
2. 初級 → 中級 → 上級のレッスン進路
3. オープンライセンスの牌画像を同梱（下記クレジット）
4. 進捗・レッスン・相談履歴は **Turso** が正。匿名 `player_id`（cookie / localStorage）で再訪時に復元

## V1.5 実戦練習

- ホームで「レッスンコーチ」⇔「実戦練習」を切替
- あなた（東・卓下）＋CPU3人。配牌〜ツモ切の簡易対局（役・点数・鳴きなし）
- 実戦練習は**横向き専用**（縦では「横にしてください」）。卓レイアウトは天鳳系:
  - 下=自分 / 上=対面 / 左=上家 / 右=下家
  - 配牌は一列・白牌面 / 各家の河は6枚折り返しで常時表示
  - 中央: 局・残り / 角: 点数 / ドラは右上＋中央
- 「解説」= 人間番のみ Jev（`/api/coach` + `mode=vs-cpu`）。CPUはヒューリスティック
- 和了（ツモ/ロン・形のみ）または荒牌流局（王牌14枚残し）で終局。「練習終了」は途中打ち切り用

## 技術

- Next.js App Router + TypeScript + Tailwind
- AI SDK 7+ `experimental_evaluate` + model `typesafe-ai/jev`
- `@libsql/client` → Turso

## セットアップ

```bash
npm install
cp .env.example .env.local
# AI_GATEWAY_API_KEY / TURSO_DATABASE_URL / TURSO_AUTH_TOKEN を設定

# Turso 未作成なら（turso auth login 済み）:
./scripts/setup-turso.sh
# または既存 DB にマイグレーションのみ:
node --env-file=.env.local scripts/migrate.mjs

npm run dev
```

### 環境変数

| 変数 | 用途 |
|------|------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway（サーバーのみ） |
| `TURSO_DATABASE_URL` | Turso DB URL |
| `TURSO_AUTH_TOKEN` | Turso 認証トークン |

## API

| Method | Path | 説明 |
|--------|------|------|
| GET/PUT | `/api/progress` | レッスン進捗。PUT は player 未作成なら upsert し `player_id` を返す |
| POST/GET | `/api/consultations` | 相談履歴。`scores_json` は `{ efficiency, safety, wait }` |
| POST | `/api/coach` | Jev 評価。body: `{ hand: TileId[14], difficulty, river? }` |

## 牌画像クレジット

PNG は [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) を `public/tiles/` に同梱しています。

- ライセンス: **CC0 1.0 / Public Domain**
- 原文: `public/tiles/LICENSE.md`

## デプロイ（Vercel）

```bash
vercel --yes
vercel env add AI_GATEWAY_API_KEY
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel --prod --yes
```

## ライセンス

アプリケーションコードはリポジトリ所有者に帰属。牌画像は上記 CC0。
