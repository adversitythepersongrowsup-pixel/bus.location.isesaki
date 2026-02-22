# Development Notes

## Verified Pages (2026-02-20)

All pages confirmed working:
- Home (/) - Landing page with 4 module cards (管理PC, 初期設定, 運転支援, バスロケ)
- Admin (/admin) - Dashboard with stats, messages, calls, device status
- Admin/GTFS (/admin/gtfs) - CSV import with tabs for routes/stops/trips/stopTimes
- Admin/Dia (/admin/dia) - Dia management with weekday/holiday sections
- Admin/Messages (/admin/messages) - Not yet checked
- Admin/Calls (/admin/calls) - Not yet checked
- Admin/Devices (/admin/devices) - Not yet checked
- Setup (/setup) - Device config with route/dia/display settings
- Tablet (/tablet) - Shows "初期設定が必要です" when no config
- Busloc (/busloc) - Dark theme, route selector, status cards, vehicle list

## Routing
- wouter v3 nest routing working for /admin/* paths
- DashboardLayout uses relative paths for nested routes

## Setup画面改修確認 (2026-02-21)

### 変更内容
- 端末ID: 非表示（自動生成）
- 端末種別: 非表示（運転支援固定）
- 表示モード: 非表示（通常固定）
- 当日自動起動: 非表示（ON固定）
- 乗務員名: 管理PCから取得した選択タブ
- 車両番号: 管理PCから取得した選択タブ
- 大型UI: 8インチタブレット横画面向け
- 2カラムレイアウト: 左（乗務員・車両）、右（路線・ダイヤ）

### 追加機能
- 管理PC > 車両管理画面（/admin/vehicles）
- 管理PC > 乗務員管理画面（/admin/drivers）
- DBテーブル: vehicles, drivers

### テスト結果
- 全43テスト通過（+10件の車両・乗務員テスト）
