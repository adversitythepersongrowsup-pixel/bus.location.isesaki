import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== 車両・乗務員テーブル ====================

/** 車両マスタ */
export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  vehicleNumber: varchar("vehicleNumber", { length: 128 }).notNull().unique(),
  vehicleName: varchar("vehicleName", { length: 256 }),
  capacity: int("capacity"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

/** 乗務員マスタ */
export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  driverName: varchar("driverName", { length: 256 }).notNull(),
  driverCode: varchar("driverCode", { length: 128 }).unique(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

// ==================== GTFS関連テーブル ====================

/** 路線名マスタ（系統の上位階層）*/
export const lines = mysqlTable("lines", {
  id: int("id").autoincrement().primaryKey(),
  lineId: varchar("lineId", { length: 128 }).notNull().unique(),
  lineName: varchar("lineName", { length: 256 }).notNull(),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Line = typeof lines.$inferSelect;
export type InsertLine = typeof lines.$inferInsert;

/** 系統 (GTFS routes) ※旧「路線名」 */
export const routes = mysqlTable("routes", {
  id: int("id").autoincrement().primaryKey(),
  routeId: varchar("routeId", { length: 128 }).notNull().unique(),
  lineId: varchar("lineId", { length: 128 }),  // 路線名マスタへの紐付け
  routeShortName: varchar("routeShortName", { length: 128 }),
  routeLongName: text("routeLongName"),  // 手動変更可能な系統名
  routeType: int("routeType").default(3), // 3 = Bus
  routeColor: varchar("routeColor", { length: 8 }),
  isMerged: boolean("isMerged").default(false).notNull(),  // 統合系統フラグ
  mergedFrom: text("mergedFrom"),  // 統合元routeIdのJSON配列 e.g. '["R001","R002"]'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Route = typeof routes.$inferSelect;
export type InsertRoute = typeof routes.$inferInsert;

/** 停留所 (GTFS stops) */
export const stops = mysqlTable("stops", {
  id: int("id").autoincrement().primaryKey(),
  stopId: varchar("stopId", { length: 128 }).notNull().unique(),
  stopName: text("stopName").notNull(),
  stopLat: varchar("stopLat", { length: 32 }),
  stopLon: varchar("stopLon", { length: 32 }),
  stopSequence: int("stopSequence"),
  routeId: varchar("routeId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Stop = typeof stops.$inferSelect;
export type InsertStop = typeof stops.$inferInsert;

/** 便 (GTFS trips) */
export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  tripId: varchar("tripId", { length: 128 }).notNull().unique(),
  routeId: varchar("routeId", { length: 128 }).notNull(),
  serviceId: varchar("serviceId", { length: 128 }),
  tripHeadsign: text("tripHeadsign"),
  directionId: int("directionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

/** 時刻表 (GTFS stop_times) */
export const stopTimes = mysqlTable("stop_times", {
  id: int("id").autoincrement().primaryKey(),
  tripId: varchar("tripId", { length: 128 }).notNull(),
  stopId: varchar("stopId", { length: 128 }).notNull(),
  arrivalTime: varchar("arrivalTime", { length: 16 }),
  departureTime: varchar("departureTime", { length: 16 }),
  stopSequence: int("stopSequence").notNull(),
  stopHeadsign: varchar("stopHeadsign", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StopTime = typeof stopTimes.$inferSelect;
export type InsertStopTime = typeof stopTimes.$inferInsert;

// ==================== ダイヤ関連テーブル ====================

/** ダイヤ (運行スケジュール) */
export const dias = mysqlTable("dias", {
  id: int("id").autoincrement().primaryKey(),
  diaName: varchar("diaName", { length: 256 }).notNull(),
  diaType: mysqlEnum("diaType", ["weekday", "holiday"]).notNull(),
  routeId: varchar("routeId", { length: 128 }),  // 系統紐付け
  lineId: varchar("lineId", { length: 128 }),  // 路線名紐付け
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Dia = typeof dias.$inferSelect;;
export type InsertDia = typeof dias.$inferInsert;

/** ダイヤ区間 (dia_segments) */
export const diaSegments = mysqlTable("dia_segments", {
  id: int("id").autoincrement().primaryKey(),
  diaId: int("diaId").notNull(),
  tripId: varchar("tripId", { length: 128 }).notNull(),
  stopId: varchar("stopId", { length: 128 }).notNull(),
  stopName: text("stopName"),
  arrivalTime: varchar("arrivalTime", { length: 16 }),
  departureTime: varchar("departureTime", { length: 16 }),
  stopSequence: int("stopSequence").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DiaSegment = typeof diaSegments.$inferSelect;
export type InsertDiaSegment = typeof diaSegments.$inferInsert;

// ==================== メッセージ・通話テーブル ====================

/** メッセージ */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  senderId: varchar("senderId", { length: 128 }).notNull(),
  senderType: mysqlEnum("senderType", ["admin", "tablet"]).notNull(),
  senderName: varchar("senderName", { length: 256 }),
  receiverId: varchar("receiverId", { length: 128 }),
  receiverType: mysqlEnum("receiverType", ["admin", "tablet"]),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/** 通話ログ */
export const callLogs = mysqlTable("call_logs", {
  id: int("id").autoincrement().primaryKey(),
  callerId: varchar("callerId", { length: 128 }).notNull(),
  callerType: mysqlEnum("callerType", ["admin", "tablet"]).notNull(),
  callerName: varchar("callerName", { length: 256 }),
  receiverId: varchar("receiverId", { length: 128 }),
  receiverType: mysqlEnum("receiverType", ["admin", "tablet"]),
  status: mysqlEnum("status", ["ringing", "active", "ended", "missed"]).default("ringing").notNull(),
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  duration: int("duration"), // seconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;

// ==================== 端末設定テーブル ====================

/** 端末設定 */
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 128 }).notNull().unique(),
  deviceName: varchar("deviceName", { length: 256 }),
  deviceType: mysqlEnum("deviceType", ["tablet", "busloc", "admin"]).default("tablet").notNull(),
  routeId: varchar("routeId", { length: 128 }),
  vehicleId: varchar("vehicleId", { length: 128 }),
  diaId: int("diaId"),
  displayMode: mysqlEnum("displayMode", ["normal", "simple", "night"]).default("normal").notNull(),
  autoStart: boolean("autoStart").default(false).notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  settings: json("settings"), // additional flexible settings
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

// ==================== バスロケーション ====================

/** バス位置情報 */
export const busLocations = mysqlTable("bus_locations", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 128 }).notNull(),
  routeId: varchar("routeId", { length: 128 }),
  tripId: varchar("tripId", { length: 128 }),
  latitude: varchar("latitude", { length: 32 }).notNull(),
  longitude: varchar("longitude", { length: 32 }).notNull(),
  speed: varchar("speed", { length: 16 }),
  heading: varchar("heading", { length: 16 }),
  delayMinutes: int("delayMinutes").default(0),
  currentStopId: varchar("currentStopId", { length: 128 }),
  nextStopId: varchar("nextStopId", { length: 128 }),
  status: mysqlEnum("status", ["in_service", "out_of_service", "delayed", "not_started"]).default("not_started").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BusLocation = typeof busLocations.$inferSelect;
export type InsertBusLocation = typeof busLocations.$inferInsert;

// ==================== デバイスステート（リアルタイム状態） ====================

/** デバイスリアルタイム状態（heartbeat・位置情報・シフト状態） */
export const deviceStates = mysqlTable("device_states", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 128 }).notNull().unique(),
  // シフト状態
  shiftConfirmed: boolean("shiftConfirmed").default(false).notNull(),
  shiftConfirmedDate: varchar("shiftConfirmedDate", { length: 16 }),
  // 運行情報
  serviceDate: varchar("serviceDate", { length: 16 }),
  routeId: varchar("routeId", { length: 128 }),
  diaId: varchar("diaId", { length: 128 }),
  vehicleNo: varchar("vehicleNo", { length: 128 }),
  driverName: varchar("driverName", { length: 256 }),
  // 位置情報
  latitude: varchar("latitude", { length: 32 }),
  longitude: varchar("longitude", { length: 32 }),
  currentStopId: varchar("currentStopId", { length: 128 }),
  currentStopName: varchar("currentStopName", { length: 256 }),
  delayMinutes: int("delayMinutes").default(0),
  // 通話状態
  callPhase: varchar("callPhase", { length: 32 }).default("idle"),
  callId: varchar("callId", { length: 128 }),
  callBusy: boolean("callBusy").default(false).notNull(),
  // 直近通過停留所（GPS実績）
  lastPassedStopId: varchar("lastPassedStopId", { length: 128 }),
  lastPassedStopName: varchar("lastPassedStopName", { length: 256 }),
  lastPassedAt: timestamp("lastPassedAt"),
  // 早発警告状態
  earlyDepartureWarning: boolean("earlyDepartureWarning").default(false).notNull(),
  // 接続状態
  isOnline: boolean("isOnline").default(false).notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeviceState = typeof deviceStates.$inferSelect;
export type InsertDeviceState = typeof deviceStates.$inferInsert;

// ==================== 公開用テーブル（外部バスロケ専用・内部データと完全分離） ====================

/**
 * 公開用到着予測テーブル
 * - 内部の位置情報(deviceStates)から計算して書き込む
 * - 外部バスロケ画面はこのテーブルのみ読む
 * - 生GPS座標は含まない
 */
export const publicArrivals = mysqlTable("public_arrivals", {
  id: int("id").autoincrement().primaryKey(),
  routeId: varchar("routeId", { length: 128 }).notNull(),
  routeShortName: varchar("routeShortName", { length: 128 }),
  stopId: varchar("stopId", { length: 128 }).notNull(),
  stopName: varchar("stopName", { length: 256 }).notNull(),
  // 到着予測（最大3本分をJSON配列で保持）
  arrivals: json("arrivals").notNull(), // Array<{ vehicleNo: string, scheduledTime: string, estimatedTime: string, delayMinutes: number, isApproaching: boolean, approachingDesc: string | null }>
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PublicArrival = typeof publicArrivals.$inferSelect;
export type InsertPublicArrival = typeof publicArrivals.$inferInsert;

/**
 * 公開用お知らせテーブル
 * - 管理PCから入力する（運休・遅延・迂回など）
 * - 外部バスロケ画面はこのテーブルのみ読む
 */
export const publicNotices = mysqlTable("public_notices", {
  id: int("id").autoincrement().primaryKey(),
  routeId: varchar("routeId", { length: 128 }),   // null = 全路線共通
  stopId: varchar("stopId", { length: 128 }),      // null = 路線全体
  noticeType: mysqlEnum("noticeType", ["info", "delay", "cancel", "detour", "other"]).default("info").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  createdBy: varchar("createdBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PublicNotice = typeof publicNotices.$inferSelect;
export type InsertPublicNotice = typeof publicNotices.$inferInsert;

// ==================== システム設定テーブル ====================
/**
 * システム全体の設定項目（キーバリュー形式）
 * 主な設定キー：
 *   gps_internal_interval_sec   … GPS内部送信間隔（秒）デフォルト 2
 *   gps_external_interval_sec   … GPS外部送信間隔（秒）デフォルト 10
 *   stop_detection_radius_m     … 停留所判定半径（m）デフォルト 30
 *   early_departure_distance_m  … 早発判定開始距離（m）デフォルト 300
 *   early_departure_seconds     … 早発判定秒数（次停留所のN秒前に到達する場合警告）デフォルト 20
 */
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: varchar("value", { length: 512 }).notNull(),
  label: varchar("label", { length: 256 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }).default("general").notNull(),
  unit: varchar("unit", { length: 32 }),
  valueType: mysqlEnum("valueType", ["integer", "float", "string", "boolean"]).default("string").notNull(),
  minValue: varchar("min_value", { length: 32 }),
  maxValue: varchar("max_value", { length: 32 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// ==================== 定型返信テーブル ====================
/** 定型返信（管理PCで設定、運転支援タブレットから利用） */
export const quickReplies = mysqlTable("quick_replies", {
  id: int("id").autoincrement().primaryKey(),
  content: varchar("content", { length: 256 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type QuickReply = typeof quickReplies.$inferSelect;
export type InsertQuickReply = typeof quickReplies.$inferInsert;

// ==================== 運行ログ ====================

/** 運行ログ */
export const operationLogs = mysqlTable("operation_logs", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 128 }),
  tripId: varchar("tripId", { length: 128 }),
  routeId: varchar("routeId", { length: 128 }),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  eventData: json("eventData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OperationLog = typeof operationLogs.$inferSelect;
export type InsertOperationLog = typeof operationLogs.$inferInsert;

// ==================== UI設定テーブル ====================
/** UI設定（管理PCのメニュー文言・表示/非表示・ページ内文言をDB管理） */
export const uiSettings = mysqlTable("ui_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 256 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  settingType: varchar("settingType", { length: 64 }).default("text").notNull(),
  description: varchar("description", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UiSetting = typeof uiSettings.$inferSelect;
export type InsertUiSetting = typeof uiSettings.$inferInsert;
