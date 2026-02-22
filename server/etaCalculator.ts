/**
 * ETA Calculator
 * heartbeat（GPS位置送信）時に呼び出し、timetableから次の停留所の到着予測を計算して
 * publicArrivalsテーブルを自動更新する。
 *
 * アルゴリズム:
 * 1. deviceStatesのdiaId・routeId・delayMinutesを取得
 * 2. timetableからダイヤの全停留所・時刻を取得
 * 3. 現在時刻＋遅延分数で「現在通過済み停留所」を特定
 * 4. 未到着の停留所に対して scheduledTime + delayMinutes = estimatedTime を計算
 * 5. 各停留所ごとに最大3本の到着予測をpublicArrivalsにupsert
 * 6. SSEでarrival_updatedイベントをブロードキャスト
 */

import * as db from "./db";
import { broadcastSSE } from "./sse";

/** HH:MM形式の時刻文字列をその日の分数に変換 */
function timeToMinutes(hhmm: string): number {
  if (!hhmm) return -1;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 現在時刻を分数で返す */
function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** 分数をHH:MM形式に変換 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 特定デバイスのheartbeatに基づいてpublicArrivalsを更新する
 */
export async function updateArrivalsFromHeartbeat(params: {
  deviceId: string;
  vehicleNo?: string | null;
  driverName?: string | null;
  routeId?: string | null;
  diaId?: string | null;
  delayMinutes?: number;
  currentStopId?: string | null;
}): Promise<void> {
  const { deviceId, vehicleNo, routeId, diaId, delayMinutes = 0, currentStopId } = params;

  // diaIdまたはrouteIdがない場合はスキップ
  if (!diaId || !routeId) return;

  const diaIdNum = parseInt(diaId, 10);
  if (isNaN(diaIdNum)) return;

  // timetableを取得
  const timetable = await db.getTimetableByDia(diaIdNum, routeId);
  if (!timetable || timetable.length === 0) return;

  const currentMinutes = nowMinutes();
  const delay = Math.round(delayMinutes ?? 0);

  // 現在通過済みの停留所インデックスを特定
  // currentStopIdが指定されていればそれを基準に、なければ時刻で判断
  let passedIdx = -1;
  if (currentStopId) {
    passedIdx = timetable.findIndex((s: any) => s.stopId === currentStopId);
  } else {
    // 現在時刻（遅延補正後）で通過済みを判断
    for (let i = 0; i < timetable.length; i++) {
      const scheduledMin = timeToMinutes(timetable[i].hhmm);
      if (scheduledMin < 0) continue;
      const estimatedMin = scheduledMin + delay;
      if (estimatedMin <= currentMinutes) {
        passedIdx = i;
      } else {
        break;
      }
    }
  }

  // 各停留所に対して到着予測を計算
  // 停留所ごとにpublicArrivalsをupsert
  const updatedStops: string[] = [];

  for (let i = 0; i < timetable.length; i++) {
    const stop = timetable[i];
    if (!stop.stopId) continue;

    const scheduledMin = timeToMinutes(stop.hhmm);
    if (scheduledMin < 0) continue;

    const estimatedMin = scheduledMin + delay;
    const isPassed = i <= passedIdx;
    const isApproaching = !isPassed && i === passedIdx + 1;

    // 既存の到着予測を取得して更新（最大3本）
    const existing = await db.getPublicArrivals(routeId, stop.stopId);
    const existingArrivals: any[] = existing?.arrivals ? (existing.arrivals as any[]) : [];

    // このデバイスのエントリを更新または追加
    const vehicleEntry = {
      vehicleNo: vehicleNo ?? deviceId,
      scheduledTime: stop.hhmm,
      estimatedTime: minutesToTime(estimatedMin),
      delayMinutes: delay,
      isApproaching,
      approachingDesc: isApproaching
        ? `まもなく到着（約${delay > 0 ? delay + "分遅れ" : "定刻"}）`
        : null,
      isPassed,
      updatedAt: Date.now(),
    };

    // 同じvehicleNoのエントリを置換、なければ追加（最大3本）
    const idx = existingArrivals.findIndex((a: any) => a.vehicleNo === vehicleEntry.vehicleNo);
    let newArrivals: any[];
    if (idx >= 0) {
      newArrivals = [...existingArrivals];
      newArrivals[idx] = vehicleEntry;
    } else {
      newArrivals = [...existingArrivals, vehicleEntry];
    }

    // 通過済みを除外して時刻順ソート、最大3本
    const activeArrivals = newArrivals
      .filter((a: any) => !a.isPassed)
      .sort((a: any, b: any) => timeToMinutes(a.estimatedTime) - timeToMinutes(b.estimatedTime))
      .slice(0, 3);

    await db.upsertPublicArrival({
      routeId,
      stopId: stop.stopId,
      stopName: stop.stopName ?? stop.stopId,
      arrivals: activeArrivals,
      updatedAt: new Date(),
    });

    updatedStops.push(stop.stopId);
  }

  // SSEブロードキャスト：バスロケ画面へ到着予測更新を通知
  if (updatedStops.length > 0) {
    broadcastSSE("arrival_updated", {
      routeId,
      vehicleNo: vehicleNo ?? deviceId,
      delayMinutes: delay,
      updatedStops,
      ts: Date.now(),
    });
  }
}
