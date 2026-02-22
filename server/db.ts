import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  vehicles, InsertVehicle,
  drivers, InsertDriver,
  routes, InsertRoute,
  stops, InsertStop,
  trips, InsertTrip,
  stopTimes, InsertStopTime,
  dias, InsertDia,
  diaSegments, InsertDiaSegment,
  messages, InsertMessage,
  callLogs, InsertCallLog,
  devices, InsertDevice,
  busLocations, InsertBusLocation,
  operationLogs, InsertOperationLog,
  deviceStates, InsertDeviceState,
  quickReplies,
  systemSettings,
  uiSettings,
  lines, InsertLine,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== Vehicles ====================

export async function createVehicle(data: InsertVehicle) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(vehicles).values(data);
  return result[0].insertId;
}

export async function getAllVehicles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles).orderBy(vehicles.vehicleNumber);
}

export async function getActiveVehicles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles).where(eq(vehicles.isActive, true)).orderBy(vehicles.vehicleNumber);
}

export async function updateVehicle(id: number, data: Partial<InsertVehicle>) {
  const db = await getDb();
  if (!db) return;
  await db.update(vehicles).set(data).where(eq(vehicles.id, id));
}

export async function deleteVehicle(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(vehicles).where(eq(vehicles.id, id));
}

// ==================== Drivers ====================

export async function createDriver(data: InsertDriver) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(drivers).values(data);
  return result[0].insertId;
}

export async function getAllDrivers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drivers).orderBy(drivers.driverName);
}

export async function getActiveDrivers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drivers).where(eq(drivers.isActive, true)).orderBy(drivers.driverName);
}

export async function updateDriver(id: number, data: Partial<InsertDriver>) {
  const db = await getDb();
  if (!db) return;
  await db.update(drivers).set(data).where(eq(drivers.id, id));
}

export async function deleteDriver(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(drivers).where(eq(drivers.id, id));
}

// ==================== Routes (GTFS) ====================

export async function clearAllRoutes() {
  const db = await getDb();
  if (!db) return;
  await db.delete(routes);
}
export async function clearAllStops() {
  const db = await getDb();
  if (!db) return;
  await db.delete(stops);
}
export async function clearAllTrips() {
  const db = await getDb();
  if (!db) return;
  await db.delete(trips);
}
export async function clearAllStopTimes() {
  const db = await getDb();
  if (!db) return;
  await db.delete(stopTimes);
}
export async function deleteAllVehicles() {
  const db = await getDb();
  if (!db) return;
  await db.delete(vehicles);
}
export async function deleteAllDrivers() {
  const db = await getDb();
  if (!db) return;
  await db.delete(drivers);
}
export async function upsertRoutes(data: InsertRoute[]) {
  const db = await getDb();
  if (!db) return;
  for (const r of data) {
    await db.insert(routes).values(r).onDuplicateKeyUpdate({
      set: { routeShortName: r.routeShortName, routeLongName: r.routeLongName, routeType: r.routeType, routeColor: r.routeColor },
    });
  }
}

export async function getAllRoutes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(routes).orderBy(routes.routeId);
}

// ==================== Stops (GTFS) ====================

export async function upsertStops(data: InsertStop[]) {
  const db = await getDb();
  if (!db) return;
  for (const s of data) {
    await db.insert(stops).values(s).onDuplicateKeyUpdate({
      set: { stopName: s.stopName, stopLat: s.stopLat, stopLon: s.stopLon, stopSequence: s.stopSequence, routeId: s.routeId },
    });
  }
}

export async function getStopsByRoute(routeId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stops).where(eq(stops.routeId, routeId)).orderBy(stops.stopSequence);
}

export async function getAllStops() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stops).orderBy(stops.stopId);
}

// ==================== Trips (GTFS) ====================

export async function upsertTrips(data: InsertTrip[]) {
  const db = await getDb();
  if (!db) return;
  for (const t of data) {
    await db.insert(trips).values(t).onDuplicateKeyUpdate({
      set: { routeId: t.routeId, serviceId: t.serviceId, tripHeadsign: t.tripHeadsign, directionId: t.directionId },
    });
  }
}

export async function getTripsByRoute(routeId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trips).where(eq(trips.routeId, routeId)).orderBy(trips.tripId);
}

export async function getAllTrips() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trips).orderBy(trips.tripId);
}

// ==================== StopTimes (GTFS) ====================

export async function upsertStopTimes(data: InsertStopTime[]) {
  const db = await getDb();
  if (!db) return;
  // Bulk insert - clear existing for the trip first
  const tripIds = Array.from(new Set(data.map(st => st.tripId)));
  for (const tid of tripIds) {
    await db.delete(stopTimes).where(eq(stopTimes.tripId, tid));
  }
  if (data.length > 0) {
    // Insert in batches of 100
    for (let i = 0; i < data.length; i += 100) {
      const batch = data.slice(i, i + 100);
      await db.insert(stopTimes).values(batch);
    }
  }
}

export async function getAllStopTimes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stopTimes).orderBy(stopTimes.tripId, stopTimes.stopSequence);
}
export async function getStopTimesByTrip(tripId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stopTimes).where(eq(stopTimes.tripId, tripId)).orderBy(stopTimes.stopSequence);
}

// ==================== Dias ====================

export async function createDia(data: InsertDia) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(dias).values(data);
  return result[0].insertId;
}

export async function getAllDias() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dias).orderBy(desc(dias.createdAt));
}

export async function getDiasByRoute(routeId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dias)
    .where(eq(dias.routeId, routeId))
    .orderBy(dias.diaType, dias.sortOrder, desc(dias.createdAt));
}

/** 路線ごとにダイヤをグループ化して返す（路線情報付き） */
export async function getDiasGroupedByRoute() {
  const db = await getDb();
  if (!db) return [];
  // 全ダイヤを取得
  const allDias = await db.select().from(dias).orderBy(dias.routeId, dias.diaType, dias.sortOrder, desc(dias.createdAt));
  // 全路線を取得（ダイヤがない系統も含む）
  const allRoutes = await db.select().from(routes).orderBy(routes.routeId);
  const routeMap = new Map(allRoutes.map(r => [r.routeId, r]));
  // routeIdごとにグループ化（先に全系統を登録しておく）
  const grouped = new Map<string, {
    routeId: string;
    routeShortName: string | null;
    routeLongName: string | null;
    weekday: typeof allDias;
    holiday: typeof allDias;
  }>();
  // 全系統を先に登録（ダイヤがなくても表示される）
  for (const route of allRoutes) {
    grouped.set(route.routeId, {
      routeId: route.routeId,
      routeShortName: route.routeShortName ?? null,
      routeLongName: route.routeLongName ?? null,
      weekday: [],
      holiday: [],
    });
  }
  // ダイヤなしのグループ（routeIdがないダイヤ）も追加
  for (const dia of allDias) {
    const key = dia.routeId ?? '__no_route__';
    if (!grouped.has(key)) {
      grouped.set(key, {
        routeId: dia.routeId ?? '',
        routeShortName: null,
        routeLongName: null,
        weekday: [],
        holiday: [],
      });
    }
    const group = grouped.get(key)!;
    if (dia.diaType === 'weekday') group.weekday.push(dia);
    else group.holiday.push(dia);
  }
  return Array.from(grouped.values());
}

export async function getDiaById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(dias).where(eq(dias.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateDia(id: number, data: Partial<InsertDia>) {
  const db = await getDb();
  if (!db) return;
  await db.update(dias).set(data).where(eq(dias.id, id));
}

export async function deleteDia(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(diaSegments).where(eq(diaSegments.diaId, id));
  await db.delete(dias).where(eq(dias.id, id));
}
/** ダイヤの並び順を一括更新 */
export async function reorderDias(orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(dias).set({ sortOrder: index }).where(eq(dias.id, id))
    )
  );
}

// ==================== DiaSegments ====================

export async function createDiaSegments(data: InsertDiaSegment[]) {
  const db = await getDb();
  if (!db) return;
  if (data.length > 0) {
    // 単一tripIdの既存セグメントは呼び出し元（routers.tsのremoveDiaSegmentsByTrip）で削除済み
    // ここではdiaId全体を削除しない（他の便のセグメントを消さないため）
    for (let i = 0; i < data.length; i += 100) {
      const batch = data.slice(i, i + 100);
      await db.insert(diaSegments).values(batch);
    }
  }
}

export async function getDiaSegmentsByDia(diaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(diaSegments).where(eq(diaSegments.diaId, diaId)).orderBy(diaSegments.stopSequence);
}

// ==================== Messages ====================

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(messages).values(data);
  return result[0].insertId;
}

export async function getMessages(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).orderBy(desc(messages.createdAt)).limit(limit);
}

export async function getMessagesByDevice(deviceId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages)
    .where(sql`${messages.senderId} = ${deviceId} OR ${messages.receiverId} = ${deviceId}`)
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export async function markMessagesAsRead(ids: number[]) {
  const db = await getDb();
  if (!db) return;
  if (ids.length > 0) {
    await db.update(messages).set({ isRead: true }).where(inArray(messages.id, ids));
  }
}

// ==================== CallLogs ====================

export async function createCallLog(data: InsertCallLog) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(callLogs).values(data);
  return result[0].insertId;
}

export async function getCallLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(callLogs).orderBy(desc(callLogs.createdAt)).limit(limit);
}

export async function updateCallLog(id: number, data: Partial<InsertCallLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(callLogs).set(data).where(eq(callLogs.id, id));
}

// ==================== Devices ====================

export async function upsertDevice(data: InsertDevice) {
  const db = await getDb();
  if (!db) return;
  await db.insert(devices).values(data).onDuplicateKeyUpdate({
    set: {
      deviceName: data.deviceName, deviceType: data.deviceType, routeId: data.routeId,
      vehicleId: data.vehicleId, diaId: data.diaId, displayMode: data.displayMode,
      autoStart: data.autoStart, settings: data.settings,
    },
  });
}

export async function getAllDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(devices).orderBy(devices.deviceId);
}

export async function getDeviceById(deviceId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(devices).where(eq(devices.deviceId, deviceId)).limit(1);
  return result[0] ?? null;
}

export async function updateDeviceOnline(deviceId: string, isOnline: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(devices).set({ isOnline, lastSyncAt: new Date() }).where(eq(devices.deviceId, deviceId));
}

export async function deleteDevice(deviceId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(devices).where(eq(devices.deviceId, deviceId));
}

// ==================== BusLocations ====================

export async function upsertBusLocation(data: InsertBusLocation) {
  const db = await getDb();
  if (!db) return;
  await db.insert(busLocations).values(data);
}

export async function getLatestBusLocations() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT bl.*, d.diaName, ds.driverName, ds.vehicleNo AS vehicleId
    FROM bus_locations bl
    INNER JOIN (
      SELECT deviceId, MAX(recordedAt) as maxRecordedAt
      FROM bus_locations
      GROUP BY deviceId
    ) latest ON bl.deviceId = latest.deviceId AND bl.recordedAt = latest.maxRecordedAt
    LEFT JOIN device_states ds ON ds.deviceId = bl.deviceId
    LEFT JOIN dias d ON d.id = ds.diaId
    ORDER BY bl.deviceId
  `);
  return (result as any)[0] as any[];
}
export async function getBusLocationsByRoute(routeId: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT bl.*, d.diaName, ds.driverName, ds.vehicleNo AS vehicleId
    FROM bus_locations bl
    INNER JOIN (
      SELECT deviceId, MAX(recordedAt) as maxRecordedAt
      FROM bus_locations
      WHERE routeId = ${routeId}
      GROUP BY deviceId
    ) latest ON bl.deviceId = latest.deviceId AND bl.recordedAt = latest.maxRecordedAt
    LEFT JOIN device_states ds ON ds.deviceId = bl.deviceId
    LEFT JOIN dias d ON d.id = ds.diaId
    ORDER BY bl.deviceId
  `);
  return (result as any)[0] as any[];
}

// ==================== OperationLogs ====================

export async function createOperationLog(data: InsertOperationLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(operationLogs).values(data);
}

export async function getOperationLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(operationLogs).orderBy(desc(operationLogs.createdAt)).limit(limit);
}

// ==================== DeviceState ====================

export async function upsertDeviceState(data: Partial<InsertDeviceState> & { deviceId: string }) {
  const db = await getDb();
  if (!db) return;
  const updateSet: Record<string, unknown> = { ...data };
  delete updateSet.deviceId;
  if (Object.keys(updateSet).length === 0) return;
  const insertData: InsertDeviceState = { deviceId: data.deviceId } as InsertDeviceState;
  Object.assign(insertData, data);
  await db.insert(deviceStates).values(insertData)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getAllDeviceStates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deviceStates).orderBy(desc(deviceStates.updatedAt));
}

/**
 * 公開用バス位置情報（個人情報・認証情報を除外）
 * 公開バスロケ画面専用。driverName/deviceId/callPhase等は含めない。
 */
export async function getPublicBusPositions() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: deviceStates.id,
      routeId: deviceStates.routeId,
      vehicleNo: deviceStates.vehicleNo,
      latitude: deviceStates.latitude,
      longitude: deviceStates.longitude,
      currentStopId: deviceStates.currentStopId,
      currentStopName: deviceStates.currentStopName,
      delayMinutes: deviceStates.delayMinutes,
      lastPassedStopName: deviceStates.lastPassedStopName,
      isOnline: deviceStates.isOnline,
      updatedAt: deviceStates.updatedAt,
    })
    .from(deviceStates)
    .where(eq(deviceStates.isOnline, true))
    .orderBy(desc(deviceStates.updatedAt));
  return rows;
}

export async function getDeviceState(deviceId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(deviceStates).where(eq(deviceStates.deviceId, deviceId)).limit(1);
  return result[0] ?? null;
}

// ==================== Timetable ====================

export async function getTimetableByDia(diaId: number, routeId?: string) {
  const db = await getDb();
  if (!db) return [];
  // diaSegmentsとstopsを結合して時刻表を返す
  const result = await db.execute(sql`
    SELECT
      ds.tripId,
      ds.stopId,
      COALESCE(ds.stopName, s.stopName) AS stopName,
      ds.arrivalTime AS hhmm,
      ds.departureTime,
      ds.stopSequence,
      COALESCE(s.stopLat, '') AS stopLat,
      COALESCE(s.stopLon, '') AS stopLng,
      d.routeId
    FROM dia_segments ds
    JOIN dias d ON d.id = ds.diaId
    LEFT JOIN stops s ON s.stopId = ds.stopId
    WHERE ds.diaId = ${diaId}
    ${routeId ? sql`AND d.routeId = ${routeId}` : sql``}
    ORDER BY ds.stopSequence ASC
  `);
  return (result as any)[0] as any[];
}

export async function getTimetableByDiaName(diaName: string, routeId?: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      ds.tripId,
      ds.stopId,
      COALESCE(ds.stopName, s.stopName) AS stopName,
      ds.arrivalTime AS hhmm,
      ds.departureTime,
      ds.stopSequence,
      COALESCE(s.stopLat, '') AS stopLat,
      COALESCE(s.stopLon, '') AS stopLng,
      d.routeId,
      d.diaName,
      d.diaType
    FROM dia_segments ds
    JOIN dias d ON d.id = ds.diaId
    LEFT JOIN stops s ON s.stopId = ds.stopId
    WHERE d.diaName = ${diaName}
    ${routeId ? sql`AND d.routeId = ${routeId}` : sql``}
    ORDER BY ds.stopSequence ASC
  `);
  return (result as any)[0] as any[];
}

// ==================== 公開用テーブル（外部バスロケ専用） ====================

import { publicArrivals, publicNotices, InsertPublicArrival, InsertPublicNotice } from "../drizzle/schema";
import { or, isNull, lte, gte } from "drizzle-orm";

/** 公開用到着予測：路線+停留所で取得（外部バスロケ画面用） */
export async function getPublicArrivals(routeId: string, stopId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(publicArrivals)
    .where(and(eq(publicArrivals.routeId, routeId), eq(publicArrivals.stopId, stopId)))
    .limit(1);
  return result[0] ?? null;
}

/** 公開用到着予測：路線の全停留所分を取得 */
export async function getPublicArrivalsByRoute(routeId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(publicArrivals).where(eq(publicArrivals.routeId, routeId));
}

/** 公開用到着予測をupsert（内部→公開データ書き込み） */
export async function upsertPublicArrival(data: InsertPublicArrival) {
  const db = await getDb();
  if (!db) return;
  await db.insert(publicArrivals).values(data).onDuplicateKeyUpdate({
    set: { arrivals: data.arrivals, updatedAt: new Date() },
  });
}

/** 公開用お知らせ：路線+停留所に関連するアクティブなお知らせを取得 */
export async function getPublicNotices(routeId?: string, stopId?: string) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const result = await db.select().from(publicNotices)
    .where(
      and(
        eq(publicNotices.isActive, true),
        or(isNull(publicNotices.endsAt), gte(publicNotices.endsAt, now)),
        or(isNull(publicNotices.startsAt), lte(publicNotices.startsAt, now)),
        routeId
          ? or(isNull(publicNotices.routeId), eq(publicNotices.routeId, routeId))
          : isNull(publicNotices.routeId),
      )
    )
    .orderBy(publicNotices.createdAt);
  // stopIdフィルタ（stopIdがnullまたは一致するもの）
  if (stopId) {
    return result.filter(n => !n.stopId || n.stopId === stopId);
  }
  return result;
}

/** 全お知らせ取得（管理PC用） */
export async function getAllPublicNotices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(publicNotices).orderBy(publicNotices.createdAt);
}

/** お知らせ作成（管理PC用） */
export async function createPublicNotice(data: InsertPublicNotice) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(publicNotices).values(data);
  return (result as any)[0];
}

/** お知らせ更新（管理PC用） */
export async function updatePublicNotice(id: number, data: Partial<InsertPublicNotice>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(publicNotices).set(data).where(eq(publicNotices.id, id));
}

/** お知らせ削除（管理PC用） */
export async function deletePublicNotice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(publicNotices).where(eq(publicNotices.id, id));
}

/** 路線の停留所一覧（ピアセグメントから取得・バスロケ画面用） */
export async function getStopsByRouteFromDia(routeId: string) {
  const db = await getDb();
  if (!db) return [];

  // 1次：diaSegmentsから取得（ダイヤに紐付いた停留所）
  const fromDia = await db.execute(sql`
    SELECT DISTINCT
      s.stopId,
      s.stopName,
      s.stopLat,
      s.stopLon,
      MIN(ds.stopSequence) AS stopSequence
    FROM stops s
    JOIN dia_segments ds ON ds.stopId = s.stopId
    JOIN dias d ON d.id = ds.diaId
    WHERE d.routeId = ${routeId}
    GROUP BY s.stopId, s.stopName, s.stopLat, s.stopLon
    ORDER BY stopSequence ASC
  `);
  const diaRows = (fromDia as any)[0] as any[];
  if (diaRows.length > 0) return diaRows;

  // 2次：GTFS stop_times → trips 経由で取得（ダイヤ未登録時のフォールバック）
  const fromGtfs = await db.execute(sql`
    SELECT DISTINCT
      s.stopId,
      COALESCE(s.stopName, st.stopId) AS stopName,
      s.stopLat,
      s.stopLon,
      MIN(st.stopSequence) AS stopSequence
    FROM stop_times st
    JOIN trips t ON t.tripId = st.tripId
    LEFT JOIN stops s ON s.stopId = st.stopId
    WHERE t.routeId = ${routeId}
    GROUP BY s.stopId, s.stopName, s.stopLat, s.stopLon, st.stopId
    ORDER BY stopSequence ASC
  `);
  return (fromGtfs as any)[0] as any[];
}

/** GTFS便一覧に始発停留所・始発時間（stop_sequence=1）・stopHeadsign・終着情報を付加して返す（ダイヤ仕分け用） */
export async function getTripsWithFirstStop(routeId?: string) {
  const db = await getDb();
  if (!db) return [];
  // TiDBはON句内のサブクエリをサポートしないため、CTEで終着停留所の最大stopSequenceを事前集計する
  const result = await db.execute(sql`
    WITH last_seq AS (
      SELECT tripId, MAX(stopSequence) AS maxSeq
      FROM stop_times
      GROUP BY tripId
    ),
    stop_cnt AS (
      SELECT tripId, COUNT(*) AS stopCount
      FROM stop_times
      GROUP BY tripId
    )
    SELECT
      t.tripId,
      t.routeId,
      t.serviceId,
      t.tripHeadsign,
      t.directionId,
      r.routeShortName,
      r.routeLongName,
      -- 始発停留所（stop_sequence=1のレコードを使用）
      first_st.stopId        AS firstStopId,
      COALESCE(first_s.stopName, first_st.stopId) AS firstStopName,
      first_st.departureTime AS firstDepartureTime,
      first_st.stopHeadsign  AS firstStopHeadsign,
      -- 終着停留所（CTEで取得したstopSequence最大値を使用）
      last_st.stopId         AS lastStopId,
      COALESCE(last_s.stopName, last_st.stopId) AS lastStopName,
      last_st.arrivalTime    AS lastArrivalTime,
      -- 停留所数
      sc.stopCount
    FROM trips t
    LEFT JOIN routes r ON r.routeId = t.routeId
    -- 始発：stopSequence=1のレコードを直接取得
    LEFT JOIN stop_times first_st ON first_st.tripId = t.tripId
      AND first_st.stopSequence = 1
    LEFT JOIN stops first_s ON first_s.stopId = first_st.stopId
    -- 終着：CTEで取得したmaxSeqを使用（ON句内サブクエリを回避）
    LEFT JOIN last_seq ls ON ls.tripId = t.tripId
    LEFT JOIN stop_times last_st ON last_st.tripId = t.tripId
      AND last_st.stopSequence = ls.maxSeq
    LEFT JOIN stops last_s ON last_s.stopId = last_st.stopId
    -- 停留所数（CTEで取得）
    LEFT JOIN stop_cnt sc ON sc.tripId = t.tripId
    ${routeId ? sql`WHERE t.routeId = ${routeId}` : sql``}
    ORDER BY first_st.departureTime ASC, t.tripId ASC
  `);
  return (result as any)[0] as Array<{
    tripId: string;
    routeId: string;
    serviceId: string | null;
    tripHeadsign: string | null;
    directionId: number | null;
    routeShortName: string | null;
    routeLongName: string | null;
    firstStopId: string | null;
    firstStopName: string | null;
    firstDepartureTime: string | null;
    firstStopHeadsign: string | null;
    lastStopId: string | null;
    lastStopName: string | null;
    lastArrivalTime: string | null;
    stopCount: number;
  }>;
}

/** ダイヤに紐付いているtripIdの一覧を返す（仕分け済み判定用） */
export async function getAssignedTripIds(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT DISTINCT tripId FROM dia_segments WHERE tripId IS NOT NULL AND tripId != ''
  `);
  return ((result as any)[0] as any[]).map((r: any) => r.tripId as string);
}

/** ダイヤから特定tripIdのsegmentsを削除（便の紐付け解除用） */
export async function removeDiaSegmentsByTrip(diaId: number, tripId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(diaSegments)
    .where(and(eq(diaSegments.diaId, diaId), eq(diaSegments.tripId, tripId)));
}

// ==================== 定型返信 ====================
export async function getActiveQuickReplies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quickReplies)
    .where(eq(quickReplies.isActive, true))
    .orderBy(quickReplies.sortOrder, quickReplies.id);
}
export async function getAllQuickReplies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quickReplies).orderBy(quickReplies.sortOrder, quickReplies.id);
}
export async function createQuickReply(content: string, sortOrder?: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(quickReplies).values({ content, sortOrder: sortOrder ?? 0, isActive: true });
  return (result as any)[0]?.insertId ?? 0;
}
export async function updateQuickReply(id: number, data: { content?: string; sortOrder?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return;
  await db.update(quickReplies).set(data).where(eq(quickReplies.id, id));
}
export async function deleteQuickReply(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quickReplies).where(eq(quickReplies.id, id));
}
export async function reorderQuickReplies(orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(quickReplies).set({ sortOrder: i }).where(eq(quickReplies.id, orderedIds[i]));
  }
}

// ==================== システム設定 ====================
/** 全設定取得（タブレット・管理PC共通） */
export async function getAllSystemSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemSettings).orderBy(systemSettings.category, systemSettings.id);
}
/** キーで設定値を取得 */
export async function getSystemSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return result[0] ?? null;
}
/** カテゴリで設定一覧取得 */
export async function getSystemSettingsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemSettings).where(eq(systemSettings.category, category)).orderBy(systemSettings.id);
}
/** 設定値を更新（keyで特定） */
export async function updateSystemSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(systemSettings).set({ value }).where(eq(systemSettings.key, key));
}
/** 設定値を一括更新（{ key: value }のマップ） */
export async function bulkUpdateSystemSettings(updates: Record<string, string>) {
  const db = await getDb();
  if (!db) return;
  for (const [key, value] of Object.entries(updates)) {
    await db.update(systemSettings).set({ value }).where(eq(systemSettings.key, key));
  }
}
/** 設定値をキーバリューマップとして取得 */
export async function getSystemSettingsMap(): Promise<Record<string, string>> {
  const rows = await getAllSystemSettings();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ==================== UI Settings ====================
/** 全UI設定を取得 */
export async function getAllUiSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(uiSettings).orderBy(uiSettings.settingKey);
}
/** UI設定をキーで取得 */
export async function getUiSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(uiSettings).where(eq(uiSettings.settingKey, key));
  return rows[0] ?? null;
}
/** UI設定を更新（なければ挿入） */
export async function upsertUiSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(uiSettings)
    .values({ settingKey: key, settingValue: value, settingType: "text" })
    .onDuplicateKeyUpdate({ set: { settingValue: value } });
}
/** UI設定を一括更新 */
export async function bulkUpsertUiSettings(updates: Array<{ key: string; value: string }>) {
  const db = await getDb();
  if (!db) return;
  for (const { key, value } of updates) {
    await db.insert(uiSettings)
      .values({ settingKey: key, settingValue: value, settingType: "text" })
      .onDuplicateKeyUpdate({ set: { settingValue: value } });
  }
}
/** UI設定をキーバリューマップとして取得 */
export async function getUiSettingsMap(): Promise<Record<string, string>> {
  const rows = await getAllUiSettings();
  return Object.fromEntries(rows.map(r => [r.settingKey, r.settingValue]));
}

// ==================== 路線名マスタ（lines） ====================
/** 路線名一覧を取得（sortOrder昇順） */
export async function getAllLines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lines).orderBy(lines.sortOrder, lines.lineName);
}
/** 路線名をIDで取得 */
export async function getLineById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(lines).where(eq(lines.id, id)).limit(1);
  return result[0] ?? null;
}
/** 路線名を作成 */
export async function createLine(data: InsertLine) {
  const db = await getDb();
  if (!db) return;
  await db.insert(lines).values(data);
}
/** 路線名を更新 */
export async function updateLine(id: number, data: Partial<InsertLine>) {
  const db = await getDb();
  if (!db) return;
  await db.update(lines).set(data).where(eq(lines.id, id));
}
/** 系統（route）を手動登録 */
export async function createRoute(data: { routeId: string; routeShortName?: string | null; routeLongName?: string | null; lineId?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(routes).values({
    routeId: data.routeId,
    routeShortName: data.routeShortName ?? null,
    routeLongName: data.routeLongName ?? null,
    lineId: (data.lineId && data.lineId !== "__none__") ? data.lineId : null,
  } as any);
}
/** 系統（route）を削除（routeId指定）—納付いているダイヤ・便・停留所情報も一併削除 */
export async function deleteRoute(routeId: string) {
  const db = await getDb();
  if (!db) return;
  // 納付いているダイヤのdiaSegmentsを削除し、ダイヤも削除
  const routeDias = await db.select({ id: dias.id }).from(dias).where(eq(dias.routeId, routeId));
  for (const d of routeDias) {
    await db.delete(diaSegments).where(eq(diaSegments.diaId, d.id));
  }
  await db.delete(dias).where(eq(dias.routeId, routeId));
  // tripsとstop_timesを削除
  const routeTrips = await db.select({ tripId: trips.tripId }).from(trips).where(eq(trips.routeId, routeId));
  for (const t of routeTrips) {
    await db.delete(stopTimes).where(eq(stopTimes.tripId, t.tripId));
  }
  await db.delete(trips).where(eq(trips.routeId, routeId));
  // routes自体を削除
  await db.delete(routes).where(eq(routes.routeId, routeId));
}
/** 路線名を削除（lineId指定） */
export async function deleteLine(lineId: string) {
  const db = await getDb();
  if (!db) return;
  // 紐付いている系統のlineIdをnullに
  await db.update(routes).set({ lineId: null } as any).where(eq(routes.lineId as any, lineId));
  // 紐付いているダイヤのlineIdをnullに
  await db.update(dias).set({ lineId: null } as any).where(eq(dias.lineId as any, lineId));
  await db.delete(lines).where(eq(lines.lineId, lineId));
}
/** 系統（route）に路線名（lineId）を紐付け */
export async function setRouteLineId(routeId: string, lineId: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(routes).set({ lineId } as any).where(eq(routes.routeId, routeId));
}
/** 路線名ごとに系統をグループ化して返す */
export async function getLinesWithRoutes() {
  const db = await getDb();
  if (!db) return [];
  const allLines = await db.select().from(lines).orderBy(lines.sortOrder, lines.lineName);
  const allRoutes = await db.select().from(routes).orderBy(routes.routeId);
  return allLines.map(line => ({
    ...line,
    routes: allRoutes.filter(r => (r as any).lineId === line.lineId),
  }));
}

// ==================== 系統（routes）手動編集 ====================
/** 系統名（routeLongName）・統合フラグを手動更新 */
export async function updateRoute(routeId: string, data: {
  routeLongName?: string;
  routeShortName?: string;
  lineId?: string | null;
  isMerged?: boolean;
  mergedFrom?: string[] | null;
}) {
  const db = await getDb();
  if (!db) return;
  const set: Record<string, unknown> = {};
  if (data.routeLongName !== undefined) set.routeLongName = data.routeLongName;
  if (data.routeShortName !== undefined) set.routeShortName = data.routeShortName;
  if (data.lineId !== undefined) set.lineId = data.lineId;
  if (data.isMerged !== undefined) set.isMerged = data.isMerged;
  if (data.mergedFrom !== undefined) {
    set.mergedFrom = data.mergedFrom ? JSON.stringify(data.mergedFrom) : null;
  }
  if (Object.keys(set).length === 0) return;
  await db.update(routes).set(set as any).where(eq(routes.routeId, routeId));
}

/** 系統一覧をlineId付きで取得 */
export async function getAllRoutesWithLine() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(routes).orderBy(routes.lineId, routes.routeId);
}

// ==================== ダイヤ（dias）lineId更新 ====================
/** ダイヤのlineId（路線名紐付け）を更新 */
export async function updateDiaLineId(id: number, lineId: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(dias).set({ lineId } as any).where(eq(dias.id, id));
}

// ==================== 路線名（lines）統合・削除 ====================
/** 路線名を統合：統合元の系統・ダイヤを統合先に移動し、統合元を削除 */
export async function mergeLines(sourceLineId: string, targetLineId: string) {
  const db = await getDb();
  if (!db) return;
  // 統合元の系統を統合先に移動
  await db.update(routes).set({ lineId: targetLineId } as any).where(eq(routes.lineId as any, sourceLineId));
  // 統合元のダイヤを統合先に移動
  await db.update(dias).set({ lineId: targetLineId } as any).where(eq(dias.lineId as any, sourceLineId));
  // 統合元の路線名を削除
  await db.delete(lines).where(eq(lines.lineId, sourceLineId));
}

// ==================== ダイヤ（dias）統合 ====================
/** ダイヤを統合：統合元のdiaSegmentsを統合先に移動し、統合元を削除 */
export async function mergeDias(sourceDiaId: number, targetDiaId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(diaSegments).set({ diaId: targetDiaId }).where(eq(diaSegments.diaId, sourceDiaId));
  await db.delete(dias).where(eq(dias.id, sourceDiaId));
}
