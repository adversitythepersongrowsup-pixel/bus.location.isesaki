# Bus Operation System TODO

## データベース・バックエンド
- [x] DBスキーマ設計（routes, trips, stops, timetables, dias, dia_segments, messages, call_logs, devices）
- [x] DBマイグレーション実行
- [x] GTFS取込API（routes/trips/timetable）
- [x] ダイヤ作成API（平日/土日祝別ダイヤ名対応）
- [x] dia.csv / dia_segments.csv 出力API
- [x] メッセージ送受信API
- [x] 通話ログAPI
- [x] 端末設定API
- [x] バスロケーション更新・取得API

## 管理PC（Admin）
- [x] ダッシュボードレイアウト（サイドバーナビゲーション）- [x] ログイン/ログアウト機能・認証状態インディケータ
- [x] GTFSデータ取込画面（routes/trips/timetable）
- [x] ダイヤ作成画面（便選択、平日/土日祝別ダイヤ名）
- [x] ダイヤ一覧・CSV出力（dia.csv / dia_segments.csv）
- [x] 通話管理画面（タブレットとの通話開始・履歴）
- [x] メッセージ管理画面（タブレットとの送受信・ログ）
- [x] 認証状態による送受信制御

## 初期設定（Setup）
- [x] 系統/車両/ダイヤ名/表示モード選択UI
- [x] 平日/土日祝ダイヤの候補選択
- [x] localStorageへの設定保存
- [x] 各本体への反映ボタン

## 運転支援タブレット（Tablet）
- [x] 通話開始・通話中UI（ミュート/終了）
- [x] 通話中の画面ロック制御
- [x] メッセージ送受信・ログ/履歴表示
- [x] 初期設定内容の参照表示
- [x] オフライン/通信断時の挙動・復帰時再同期
- [x] 当日状態による自動表示/非表示制御
- [x] PWA対応（manifest/service worker）

## バスロケ（Busloc）
- [x] 路線/系統表示
- [x] 現在位置・遅れ状況の可視化
- [x] 内部/外部表示の更新周期切り替え
- [x] 管理PC設定データとの連動

## テスト
- [x] Vitestテスト作成（auth, gtfs, dia, message, callLog, device, busLocation, operationLog）
- [x] 全33テスト通過確認

## バグ修正・機能復元（v1.11）
- [x] ロールバックにより消失したschema.ts（stopHeadsign・deviceStates・publicArrivals・publicNotices）を再追加
- [x] db.tsにgetTripsWithFirstStop・getAssignedTripIds・removeDiaSegmentsByTrip・deviceState・publicArrivals・publicNotices関数を再追加
- [x] routers.tsにgtfs.getTripsWithFirstStop・gtfs.getAssignedTripIds・dia.assignTrip・dia.removeTrip・deviceStateルーター・noticeルーター・publicBuslocルーターを再追加
- [x] sse.tsを再作成・server/_core/index.tsにSSEエンドポイント登録
- [x] noticeルーターのcreate/update/deleteにbroadcastSSE追加
- [x] 全33テスト通過・SSE HTTP 200確認

## バグ修正：UI初期状態への退行（v1.12）
- [x] 原因：v1.11のロールバック作業でUIファイルが古いバージョンに戻っていた
- [x] ebaad0b（v1.10）から全UIファイルをgit checkoutで復元
- [x] @dnd-kit・react-leaflet・leaflet・@dnd-kit/sortable・@dnd-kit/utilitiesを再インストール
- [x] routers.test.tsのpublicProcedureテストを実装に合わせて修正
- [x] TypeScriptエラー0件・全33テスト通過確認

## バグ修正・機能追加（v1.13）
- [x] ダイヤ並び替え保存バグ修正（並び替え後に保存されない問題）
- [x] 運行管理メニューの並び替え機能追加（D&Dで順序変更・localStorageに保存）

## GPS・運転支援機能（v1.14）
- [x] DBスキーマ：quick_repliesテーブル追加（定型返信PC管理）
- [x] DBスキーマ：deviceStatesにlastPassedStop情報・earlyDepartureWarningカラム追加
- [x] サーバーAPI：GPS停留所判定（30m）・直近通過停留所更新
- [x] サーバーAPI：早発警告（300m手前で20秒前判定）
- [x] サーバーAPI：定型返信CRUD（管理PC用）
- [x] タブレット：GPS停留所判定ロジック（フロントエンド側）
- [x] タブレット：直近通過停留所表示（実績ベース）
- [x] タブレット：早発警告（画面赤フラッシュ＋音声アラート）
- [x] タブレット：遅延表示（+3分形式、右寄せ赤字）
- [x] タブレット：音声入力機能（Web Speech API）
- [x] タブレット：車両間通話・メッセージ機能
- [x] タブレット：定型返信をDBから取得（PC管理連携）
- [x] 管理PC：定型返信設定画面（CRUD）
- [x] 管理PC：AdminBuslocにリアルタイム位置・停留所情報表示強化

## システム設定機能（v1.14追加要件）
- [x] DBにsystem_settingsテーブル追加（キーバリュー形式）
- [x] 設定項目：GPS内部送信間隔（秒）・GPS外部送信間隔（秒）・停留所判定距離（m）・早発判定距離（m）・早発判定秒数（秒）
- [x] サーバーAPI：設定取得・更新（管理PC用）・全設定一括取得（タブレット用）
- [x] 管理PC：システム設定画面（/admin/system-settings 新規ページ）
- [x] タブレット：起動時にサーバーから設定を取得してGPS判定に使用

## UI修正（v1.15）
- [x] GTFS取込：路線一覧タブ（路線/停留所/便/時刻表）の内容が切り替わらないバグ修正
- [x] GTFS取込：インポートモード選択（追加・削除・上書き）
- [x] バスロケ車両一覧：ダイヤ列追加・乗務員名列追加・状態列削除・大文字化・ソート機能
- [x] 車両管理：全削除ボタン追加・リスト表示に変更
- [x] 乗務員管理：全削除ボタン追加・リスト表示に変更

## UI修正（v1.16）
- [x] 初期設定：左タブ（路線/ダイヤ/車両/乗務員）＋右リスト形式に全面改修・選択後自動次タブ遷移
- [ ] 管理PC：UIの文言・レイアウト・機能を編集できる仕様（カスタマイズ機能）
- [x] 車両管理：車両番号でソートできる機能（テーブルヘッダークリックで昇順/降順）

## UI編集機能（v1.16追加要件）
- [x] DBにui_settingsテーブル追加（メニュー文言・表示非表示・追加項目・ページ内文言）
- [x] サーバーAPI：ui_settings CRUD（uiSettingsRouter実装済み）
- [ ] DashboardLayout：メニュー文言変更・表示/非表示・項目追加の編集モード
- [ ] 各管理画面：見出し・説明文のインライン編集機能
- [x] 車両管理：車両番号ソート機能追加（実装済み）
- [x] 乗務員管理：乗務員コードでソートできる機能（実装済み）

## 機能追加（v1.17）
- [ ] バスロケ：停留所名を指定したら緯度経度から地図を移動・停留所を中心表示
- [ ] 管理PC左ペイン上部：運行情報・お知らせを表示（表示項目をPC管理で設定可能）
- [ ] バスロケ：スマートフォン向けUIに最適化（タッチ操作・大きなボタン・縦スクロール重視）
- [ ] 道路状況：現在地から3km圈内の渋滹・事故・通行止情報を取得してメッセージ送信機能を追加

## 道路状況取得機能（v1.17追加）
- [x] server/routers.ts：trafficRouterにgetIncidentsエンドポイント追加（HERE Traffic API v7統合）
- [x] TabletDriver.tsx：「🚦 道路状況」ボタン追加（アクションボタン行）
- [x] TabletDriver.tsx：道路状況モーダル（3km圏内の渋滞/事故/通行止め表示・管理者送信機能）

## GTFS便仕分け修正（v1.18）
- [x] 全路線のstop_timesを参照（routeId指定なしで全便取得）
- [x] departure_time→trip_id順ソート（DB側実装済み）
- [x] stop_sequence=1の始発時間のみ表示（HH:MM形式に整形）
- [x] 方向はstop_headsign優先、NULLならtripHeadsignにフォールバック
- [x] TiDBのON句内サブクエリ制限をCTE方式で回避（終着停留所の最大stopSequence取得）
- [x] 路線名（routeShortName）を便カードに追加表示

## バスロケ公開アクセス対応（v1.19）
- [ ] バスロケ画面のアクセス制御・API・個人情報流出リスクを調査
- [ ] 公開用バスロケAPIを安全に分離（個人情報・認証情報を含めない）
- [ ] バスロケ画面の認証ガードを外して公開アクセスを有効化
- [ ] タブレット横画面UI最適化（TabletDriver.tsx・Setup.tsx）
- [x] バスロケ画面：Leaflet地図がUI要素に重なって見えない問題を修正（zIndex・レイアウト）

## ダイヤ管理・路線名・系統仕様変更（v1.20）
- [ ] DBスキーマ：routesにisMerged（統合フラグ）・mergedFrom（統合元系統IDリスト）追加
- [ ] DBスキーマ：linesテーブルのlineName手動変更対応（既存）
- [ ] DBスキーマ：routesのrouteLongName手動変更対応（既存）
- [ ] API：路線名（lines）の手動名称変更エンドポイント
- [ ] API：系統（routes）の手動名称変更エンドポイント
- [ ] API：系統の統合フラグ（isMerged）更新エンドポイント
- [ ] DiaManagement：ダイヤ作成フォームに路線名(lineId)選択を追加
- [ ] DiaManagement：系統名・路線名のインライン編集UI
- [ ] DiaManagement：系統統合フラグの表示・切り替えUI
- [ ] LineManagement：路線名の手動編集・削除
- [ ] RouteManagement：系統名の手動編集・統合フラグ管理

## ダイヤ管理・路線名・系統仕様変更（v1.20）
- [x] DB: routesにisMerged・mergedFromカラム追加、diasにlineId追加
- [x] API: 系統手動編集（routeShortName/routeLongName/lineId/isMerged/mergedFrom）
- [x] DiaManagement: 系統ヘッダーに編集ボタン・統合フラグバッジ・系統編集ダイアログ追加
- [x] LineManagement: 系統一覧に編集ボタン・統合フラグバッジ・系統編集ダイアログ追加
- [x] 路線名手動変更（編集ダイアログは既実装済み）

## 路線名・ダイヤ統合画面（v1.21）
- [x] 路線名管理とダイヤ作成を1画面に統合（路線名→系統→ダイヤ 3階層アコーディオン）
- [x] 路線名の統合機能（複数の路線名を1つにまとめる）
- [x] ダイヤの統合機能（複数のダイヤを1つにまとめる）
- [x] 路線名の削除ボタン
- [x] ダイヤの削除ボタン
- [x] DashboardLayoutのメニューからLineManagementを削除してDiaManagementに統合

### 系統削除機能（v1.22）
- [x] db.ts: deleteRoute(routeId)関数を追加
- [x] routers.ts: line.deleteRouteエンドポイントを追加
- [x] DiaManagement.tsx: 路線名未設定グループの系統行に削除ボタンを追加
- [x] DiaManagement.tsx: 全系統行（路線名設定済も含む）に削除ボタンを追加
## 系統追加機能（v1.23）
- [x] db.ts: createRoute関数を追加
- [x] routers.ts: line.createRouteエンドポイントを追加
- [x] DiaManagement.tsx: ヘッダーに系統追加ボタンを追加
- [x] DiaManagement.tsx: 系統追加ダイアログ（routeId・routeShortName・routeLongName・lineId）を実装

## GTFS便仕分け平日・土日祝フィルター（v1.25）
- [x] GTFSカレンダー情報（calendar/calendar_dates）のDB構造を確認
- [x] getTripsWithFirstStopにservice_id/曜日情報を追加
- [x] TripAssignPanelに平日・土日祝フィルターUIを追加

## 初期設定画面の乗務員コード順ソート（v1.26）
- [x] Setup.tsx: 乗務員名選択セレクトをdriverCode昇順に並べ替え

## 通話先端末表示変更（v1.27）
- [x] 通話先端末の表示をダイヤ名-車両番号-乗務員名の形式に変更

## メッセージ管理端末表示変更（v1.27b）
- [x] Messages.tsx: 端末一覧の表示をダイヤ-車両番号-乗務員名形式に変更

## 端末一覧のダイヤ表示をdiaName（名前）に変更（v1.28）
- [x] Calls.tsx: diaId→diaNameに変換して表示
- [x] Messages.tsx: diaId→diaNameに変換して表示

## 端末表示形式を「ダイヤ:xxx - 車両:xxx - 乗務員:xxx」に変更（v1.29）
- [x] Calls.tsx: 端末一覧と通話履歴の相手端末を「ダイヤ:xxx - 車両:xxx - 乗務員:xxx」形式に変更
- [x] Messages.tsx: 端末一覧と送信先を「ダイヤ:xxx - 車両:xxx - 乗務員:xxx」形式に変更

## GTFS便仕分け複数選択（v1.30）
- [x] TripAssignPanel: 便選択をチェックボックス複数選択に変更
- [x] TripAssignPanel: 選択した便を一括でダイヤに割り当てるボタンを追加
- [x] TripAssignPanel: 全選択・全解除ボタンを追加

## バグ修正：便仕分けが保存されない（v1.31）
- [x] createDiaSegments関数がdiaId全体を削除してから挿入していたため、複数便を紐付けると後から紐付けた便しか残らなかった
- [x] 修正：diaId全削除を廃止し、呼び出し元（removeDiaSegmentsByTrip）で同一tripIdのみ削除する方式に変更
