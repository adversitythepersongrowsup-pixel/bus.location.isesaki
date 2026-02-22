import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useMessageSSE } from "@/hooks/useSSE";

// ==================== 型定義 ====================
interface SetupConfig {
  deviceId: string;
  driverName: string;
  driverId: number | null;
  vehicleNumber: string;
  vehicleId: number | null;
  routeId: string;
  diaId: number | null;
  savedAt: string;
}
interface TimetableRow {
  tripId: string;
  stopId: string;
  stopName: string;
  hhmm: string;
  departureTime?: string;
  stopSequence: number;
  stopLat?: string;
  stopLng?: string;
  routeId?: string;
  tmin?: number;
}
interface MessageItem {
  id: number;
  senderId: string;
  senderType: "admin" | "tablet";
  senderName?: string | null;
  receiverId?: string | null;
  content: string;
  isRead: boolean;
  createdAt: Date | string;
}
type CallPhase = "idle" | "ringing" | "active";
type MsgFilter = "all" | "admin" | "vehicle";

// ==================== ユーティリティ ====================
const SETUP_STORAGE_KEY = "bus_operation_setup";
function getStoredConfig(): SetupConfig | null {
  try {
    const s = localStorage.getItem(SETUP_STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
function tokyoHHMM(d: Date): string {
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tokyo" });
}
function tokyoSS(d: Date): string {
  return d.getSeconds().toString().padStart(2, "0");
}
function hhmmToMin(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 99999;
}
function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function nowSec(): number {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}
function formatMsgTime(ts: Date | string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
/** 2点間の距離（メートル）を計算（Haversine） */
function calcDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ==================== メインコンポーネント ====================
export default function TabletDriver() {
  const [, setLocation] = useLocation();
  const config = getStoredConfig();

  useEffect(() => {
    if (!config) {
      toast.info("初期設定が必要です");
      setLocation("/setup");
    }
  }, []);

  // 時計
  const [nowHM, setNowHM] = useState(() => tokyoHHMM(new Date()));
  const [nowSSStr, setNowSSStr] = useState(() => tokyoSS(new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowHM(tokyoHHMM(d));
      setNowSSStr(tokyoSS(d));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 通話状態
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [callWho, setCallWho] = useState("管理者");
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  useEffect(() => {
    if (callPhase === "active") {
      callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [callPhase]);

  // オフライン状態
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); toast.success("接続が回復しました"); };
    const onOffline = () => { setIsOnline(false); toast.warning("オフラインです"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // 定型返信モーダル
  const [showQuick, setShowQuick] = useState(false);
  // 車両選択モーダル（車両間通話）
  const [showVehicleSelect, setShowVehicleSelect] = useState(false);
  // 音声入力状態
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // メッセージフィルター
  const [msgFilter, setMsgFilter] = useState<MsgFilter>("all");
  // メッセージ入力
  const [msgInput, setMsgInput] = useState("");
  // 早発警告状態
  const [earlyWarning, setEarlyWarning] = useState(false);
  const [warnFlash, setWarnFlash] = useState(false);
  // 直近通過停留所（GPS実績）
  const [lastPassedStop, setLastPassedStop] = useState<{ stopId: string; stopName: string; hhmm?: string } | null>(null);
  // GPS位置
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const [isGpsActive, setIsGpsActive] = useState(false);
  // 道路状況モーダル
  const [showTrafficModal, setShowTrafficModal] = useState(false);
  const [trafficQueryPos, setTrafficQueryPos] = useState<{ lat: number; lng: number } | null>(null);
  // 次停留所インデックス（GPS判定で確定）
  const nextStopIdxRef = useRef(0);
  const [nextStopIdxState, setNextStopIdxState] = useState(0);

  // ==================== API呼び出し ====================
  // システム設定取得
  const { data: settingsMap } = trpc.systemSettings.getMap.useQuery(undefined, {
    staleTime: 60000,
  });
  const getSetting = useCallback((key: string, defaultVal: number): number => {
    if (!settingsMap) return defaultVal;
    const v = (settingsMap as Record<string, string>)[key];
    return v !== undefined ? parseFloat(v) : defaultVal;
  }, [settingsMap]);
  const getSettingBool = useCallback((key: string, defaultVal: boolean): boolean => {
    if (!settingsMap) return defaultVal;
    const v = (settingsMap as Record<string, string>)[key];
    return v !== undefined ? v === "true" : defaultVal;
  }, [settingsMap]);

  // 時刻表取得
  const { data: timetableRows } = trpc.timetable.getByDia.useQuery(
    { diaId: config?.diaId ?? 0, routeId: config?.routeId },
    { enabled: !!(config?.diaId), refetchInterval: 60000 }
  );
  // メッセージ取得
  const { data: messages } = trpc.message.list.useQuery(
    { limit: 50 },
    { refetchInterval: isOnline ? 30000 : false }
  );
  // 定型返信取得（DBから）
  const { data: quickRepliesData } = trpc.quickReply.list.useQuery();
  // 全端末一覧（車両間通話用）
  const { data: allDeviceStates } = trpc.deviceState.listAll.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const [localMessages, setLocalMessages] = useState<MessageItem[]>([]);
  useEffect(() => {
    if (messages) setLocalMessages(messages as MessageItem[]);
  }, [messages]);

  const utils = trpc.useUtils();
  const handleNewSSEMessage = useCallback((msg: any) => {
    const typedMsg: MessageItem = { ...msg, senderType: (msg.senderType as "admin" | "tablet") };
    setLocalMessages(prev => {
      if (prev.some(m => m.id === typedMsg.id)) return prev;
      const updated = [...prev, typedMsg];
      updated.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return updated;
    });
    if (typedMsg.senderType === "admin") {
      toast.info(`📨 ${typedMsg.senderName ?? "管理者"}: ${typedMsg.content}`, { duration: 5000 });
    } else if (typedMsg.senderType === "tablet" && typedMsg.senderId !== config?.deviceId) {
      toast.info(`🚌 ${typedMsg.senderName ?? typedMsg.senderId}: ${typedMsg.content}`, { duration: 5000 });
    }
    utils.message.list.invalidate();
  }, [utils, config?.deviceId]);

  useMessageSSE({
    deviceId: config?.deviceId,
    onNewMessage: handleNewSSEMessage,
    onConnected: () => {},
    onError: () => {},
    enabled: isOnline,
  });

  // 道路状況取得
  const { data: trafficData, isFetching: trafficFetching, refetch: refetchTraffic } = trpc.traffic.getIncidents.useQuery(
    { lat: trafficQueryPos?.lat ?? 0, lng: trafficQueryPos?.lng ?? 0, radiusMeters: 3000 },
    { enabled: showTrafficModal && trafficQueryPos !== null, staleTime: 60000 }
  );

  const sendMsgMut = trpc.message.send.useMutation();
  const startCallMut = trpc.callLog.start.useMutation();
  const updateCallMut = trpc.callLog.updateStatus.useMutation();
  const heartbeatMut = trpc.deviceState.heartbeat.useMutation();
  const markReadMut = trpc.message.markRead.useMutation();

  // ==================== 時刻表計算 ====================
  const sortedRows = useMemo((): TimetableRow[] => {
    if (!timetableRows || !Array.isArray(timetableRows)) return [];
    return (timetableRows as TimetableRow[])
      .map(r => ({ ...r, tmin: hhmmToMin(r.hhmm) }))
      .filter(r => (r.tmin ?? 99999) < 99999)
      .sort((a, b) => (a.tmin ?? 0) - (b.tmin ?? 0));
  }, [timetableRows]);

  // 現在時刻以降の停留所（nextStopIdxStateから）
  const upcomingStops = useMemo((): TimetableRow[] => {
    const cur = nowMin();
    const fromIdx = sortedRows.slice(nextStopIdxState);
    const future = fromIdx.filter(r => (r.tmin ?? 0) >= cur);
    return future.length > 0 ? future.slice(0, 4) : fromIdx.slice(0, 4);
  }, [sortedRows, nextStopIdxState, nowHM]);

  const nextStop = upcomingStops[0] ?? null;
  const next2Stop = upcomingStops[1] ?? null;
  const next3Stop = upcomingStops[2] ?? null;

  function calcDelayStr(stop: TimetableRow | null): { text: string; isDelay: boolean } {
    if (!stop) return { text: "-", isDelay: false };
    const cur = nowSec();
    const stopSec = (stop.tmin ?? 0) * 60;
    const diff = stopSec - cur;
    if (Math.abs(diff) < 30) return { text: "定刻", isDelay: false };
    if (diff > 0) {
      const m = Math.floor(diff / 60);
      return { text: `+${m}分`, isDelay: false };
    }
    const m = Math.floor(Math.abs(diff) / 60);
    return { text: `-${m}分`, isDelay: true };
  }

  // ==================== GPS・停留所判定 ====================
  useEffect(() => {
    if (!config?.deviceId) return;

    const stopRadiusM = getSetting("stop_detection_radius_m", 30);
    const earlyDistM = getSetting("early_departure_distance_m", 300);
    const earlySec = getSetting("early_departure_seconds", 20);
    const internalIntervalSec = getSetting("gps_internal_interval_sec", 2);
    const highAccuracy = getSettingBool("gps_high_accuracy", true);
    const maxAgeMs = getSetting("gps_max_age_ms", 5000);

    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          posRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setIsGpsActive(true);
        },
        (err) => {
          console.warn("GPS error:", err);
          setIsGpsActive(false);
        },
        { enableHighAccuracy: highAccuracy, maximumAge: maxAgeMs }
      );
    }

    const heartbeatTimer = setInterval(() => {
      if (!isOnline) return;
      const pos = posRef.current;

      // 停留所判定（GPS取得時のみ）
      let newLastPassed: { stopId: string; stopName: string; hhmm?: string } | null = null;
      let newEarlyWarning = false;

      if (pos && sortedRows.length > 0) {
        const currentNextRow = sortedRows[nextStopIdxRef.current];
        if (currentNextRow?.stopLat && currentNextRow?.stopLng) {
          const distToNext = calcDistanceM(
            pos.lat, pos.lng,
            parseFloat(currentNextRow.stopLat),
            parseFloat(currentNextRow.stopLng)
          );
          // 停留所判定（設定距離以内）
          if (distToNext <= stopRadiusM) {
            newLastPassed = { stopId: currentNextRow.stopId, stopName: currentNextRow.stopName, hhmm: currentNextRow.hhmm };
            const newIdx = Math.min(nextStopIdxRef.current + 1, sortedRows.length - 1);
            nextStopIdxRef.current = newIdx;
            setNextStopIdxState(newIdx);
            setLastPassedStop(newLastPassed);
          }
          // 早発判定（設定距離手前で設定秒数前に到達する場合）
          if (distToNext <= earlyDistM && distToNext > stopRadiusM) {
            const curSec = nowSec();
            const stopSec = (currentNextRow.tmin ?? 0) * 60;
            const secUntilStop = stopSec - curSec;
            if (secUntilStop > 0 && secUntilStop <= earlySec) {
              newEarlyWarning = true;
            }
          }
        }
      }

      // 早発警告の更新
      if (newEarlyWarning && !earlyWarning) {
        setEarlyWarning(true);
        setWarnFlash(true);
        setTimeout(() => setWarnFlash(false), 3000);
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "square";
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 1.5);
        } catch { /* ignore */ }
        toast.warning("⚠️ 早発の危険があります！", { duration: 5000 });
      } else if (!newEarlyWarning && earlyWarning) {
        setEarlyWarning(false);
      }

      const nextStopForHB = sortedRows[nextStopIdxRef.current];
      heartbeatMut.mutate({
        deviceId: config.deviceId,
        latitude: pos ? pos.lat.toFixed(6) : undefined,
        longitude: pos ? pos.lng.toFixed(6) : undefined,
        currentStopId: nextStopForHB?.stopId,
        currentStopName: nextStopForHB?.stopName,
        delayMinutes: 0,
        callPhase,
        callBusy: callPhase !== "idle",
        lastPassedStopId: newLastPassed?.stopId,
        lastPassedStopName: newLastPassed?.stopName,
        earlyDepartureWarning: newEarlyWarning,
      });
    }, internalIntervalSec * 1000);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeatTimer);
    };
  }, [config?.deviceId, isOnline, callPhase, sortedRows, earlyWarning, settingsMap]);

  // ==================== メッセージ処理 ====================
  const filteredMessages = useMemo(() => {
    if (msgFilter === "admin") return localMessages.filter(m => m.senderType === "admin");
    if (msgFilter === "vehicle") return localMessages.filter(m => m.senderType === "tablet");
    return localMessages;
  }, [localMessages, msgFilter]);

  const handleSendMsg = async (text?: string) => {
    const content = (text ?? msgInput).trim();
    if (!content) return;
    if (!config?.deviceId) { toast.error("端末IDが設定されていません"); return; }
    try {
      await sendMsgMut.mutateAsync({
        senderId: config.deviceId,
        senderType: "tablet",
        senderName: config.driverName,
        content,
      });
      if (!text) setMsgInput("");
    } catch {
      toast.error("送信に失敗しました");
    }
  };

  const handleQuickReply = async (text: string) => {
    await handleSendMsg(text);
    setShowQuick(false);
    toast.success("送信しました");
  };

  // 未読メッセージを既読にする
  const unreadIds = useMemo(() =>
    localMessages.filter(m => !m.isRead && m.senderType !== "tablet").map(m => m.id),
    [localMessages]
  );
  useEffect(() => {
    if (unreadIds.length > 0) {
      markReadMut.mutate({ ids: unreadIds });
    }
  }, [unreadIds.join(",")]);

  // ==================== 音声入力 ====================
  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("このブラウザは音声入力に対応していません");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMsgInput(prev => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // ==================== 通話処理 ====================
  const handleCall = async (targetDeviceId?: string, targetName?: string) => {
    if (!config?.deviceId) { toast.error("端末設定が必要です"); return; }
    try {
      const result = await startCallMut.mutateAsync({
        callerId: config.deviceId,
        callerType: "tablet",
        callerName: config.driverName || config.deviceId,
        receiverId: targetDeviceId,
        receiverType: targetDeviceId ? "tablet" : "admin",
      });
      setActiveCallId(result.callId);
      setCallWho(targetName ?? "管理者");
      setCallPhase("ringing");
      setShowVehicleSelect(false);
      setTimeout(async () => {
        setCallPhase("active");
        if (result.callId) {
          await updateCallMut.mutateAsync({ id: result.callId, status: "active" });
        }
      }, 2000);
    } catch {
      toast.error("通話の開始に失敗しました");
    }
  };

  const handleHangup = async () => {
    if (activeCallId) {
      try {
        await updateCallMut.mutateAsync({ id: activeCallId, status: "ended", duration: callDuration });
      } catch { /* ignore */ }
    }
    setCallPhase("idle");
    setActiveCallId(null);
    setIsMuted(false);
  };
  const handleMute = () => setIsMuted(m => !m);
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // ==================== レンダリング ====================
  if (!config) return null;

  const unreadCount = localMessages.filter(m => !m.isRead && m.senderType !== "tablet").length;

  return (
    <div style={{
      height: "100dvh",
      background: earlyWarning ? (warnFlash ? "#450a0a" : "#1a0505") : "#0f172a",
      color: "#f1f5f9",
      fontFamily: "'Noto Sans JP', 'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      transition: "background 0.3s",
    }}>
      {/* 早発警告バナー */}
      {earlyWarning && (
        <div style={{
          background: "#ef4444",
          color: "#fff",
          textAlign: "center",
          padding: "10px",
          fontWeight: 900,
          fontSize: "18px",
          letterSpacing: "0.05em",
          flexShrink: 0,
        }}>
          ⚠️ 早発の危険！ 次の停留所の通過時刻前です ⚠️
        </div>
      )}

      {/* ヘッダー */}
      <header style={{
        background: "#1e293b",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "0 16px",
        height: "52px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontWeight: 900, fontSize: "17px" }}>🚌 運転支援</span>
          <span style={{
            fontSize: "12px", padding: "2px 10px", borderRadius: "20px",
            background: isOnline ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${isOnline ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: isOnline ? "#4ade80" : "#f87171", fontWeight: 700,
          }}>
            {isOnline ? "オンライン" : "オフライン"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 700 }}>
            {config.driverName} / {config.vehicleNumber}
          </span>
          <button onClick={() => setLocation("/setup")} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "8px", color: "#cbd5e1", padding: "5px 12px",
            fontSize: "12px", fontWeight: 700, cursor: "pointer",
          }}>
            ⚙ 設定
          </button>
        </div>
      </header>

      {/* メインコンテンツ: 左右2ペイン */}
      <div style={{
        flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr",
        overflow: "hidden", minHeight: 0,
      }}>
        {/* ===== 左ペイン: 連絡 ===== */}
        <section style={{
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 14px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 900, fontSize: "18px" }}>💬 連絡</span>
            {unreadCount > 0 && (
              <span style={{
                background: "#ef4444", color: "#fff", borderRadius: "20px",
                padding: "2px 8px", fontSize: "12px", fontWeight: 900,
              }}>
                {unreadCount}件未読
              </span>
            )}
          </div>

          {/* 通話バー（通話中のみ表示） */}
          {callPhase !== "idle" && (
            <div style={{
              margin: "8px 10px", padding: "12px", borderRadius: "12px",
              background: callPhase === "active" ? "rgba(37,99,235,0.15)" : "rgba(234,179,8,0.12)",
              border: `1px solid ${callPhase === "active" ? "rgba(37,99,235,0.5)" : "rgba(234,179,8,0.4)"}`,
              flexShrink: 0,
            }}>
              <div style={{ fontWeight: 900, fontSize: "16px", marginBottom: "6px" }}>
                {callPhase === "ringing" ? `📞 ${callWho}に発信中...` : `📞 ${callWho}と通話中 ${formatCallDuration(callDuration)}`}
              </div>
              {isMuted && <div style={{ fontSize: "12px", color: "#fbbf24", marginBottom: "6px" }}>🔇 ミュート中</div>}
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={handleMute} style={{
                  flex: 1, padding: "10px", borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: isMuted ? "rgba(234,179,8,0.2)" : "rgba(255,255,255,0.08)",
                  color: "#f1f5f9", fontSize: "14px", fontWeight: 900, cursor: "pointer",
                }}>
                  {isMuted ? "🔊 解除" : "🔇 ミュート"}
                </button>
                <button onClick={handleHangup} style={{
                  flex: 1, padding: "10px", borderRadius: "8px",
                  border: "1px solid rgba(239,68,68,0.5)",
                  background: "rgba(239,68,68,0.2)",
                  color: "#fca5a5", fontSize: "14px", fontWeight: 900, cursor: "pointer",
                }}>
                  📵 切断
                </button>
              </div>
            </div>
          )}

          {/* フィルタータブ */}
          <div style={{
            display: "flex", gap: "6px", padding: "6px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
          }}>
            {(["all", "admin", "vehicle"] as MsgFilter[]).map(f => (
              <button key={f} onClick={() => setMsgFilter(f)} style={{
                padding: "5px 12px", borderRadius: "20px", border: "1px solid",
                borderColor: msgFilter === f ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)",
                background: msgFilter === f ? "rgba(99,102,241,0.2)" : "transparent",
                color: msgFilter === f ? "#a5b4fc" : "#64748b",
                fontSize: "12px", fontWeight: 700, cursor: "pointer",
              }}>
                {f === "all" ? "全て" : f === "admin" ? "管理者" : "車両"}
              </button>
            ))}
          </div>

          {/* メッセージ一覧 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {filteredMessages.length === 0 ? (
              <div style={{ color: "#475569", fontSize: "13px", textAlign: "center", marginTop: "20px" }}>
                メッセージはありません
              </div>
            ) : (
              [...filteredMessages].reverse().map(msg => {
                const isMe = msg.senderId === config.deviceId;
                return (
                  <div key={msg.id} style={{
                    display: "flex",
                    flexDirection: isMe ? "row-reverse" : "row",
                    gap: "8px", marginBottom: "10px", alignItems: "flex-end",
                  }}>
                    <div style={{
                      maxWidth: "75%", padding: "10px 12px",
                      borderRadius: isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                      background: isMe ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.07)",
                      border: "1px solid",
                      borderColor: isMe ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.1)",
                    }}>
                      {!isMe && (
                        <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px", fontWeight: 700 }}>
                          {msg.senderType === "admin" ? "🏢 管理者" : `🚌 ${msg.senderName ?? msg.senderId}`}
                        </div>
                      )}
                      <div style={{ fontSize: "15px", color: "#e2e8f0", lineHeight: 1.5 }}>{msg.content}</div>
                      <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px", textAlign: isMe ? "left" : "right" }}>
                        {formatMsgTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* メッセージ入力エリア */}
          <div style={{
            padding: "8px 10px",
            borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
              <input
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMsg(); } }}
                placeholder="メッセージを入力..."
                style={{
                  flex: 1, background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)", borderRadius: "10px",
                  color: "#f1f5f9", padding: "10px 12px", fontSize: "15px", outline: "none",
                }}
              />
              {/* 音声入力ボタン */}
              <button onClick={startVoiceInput} title="音声入力" style={{
                padding: "10px 12px", borderRadius: "10px", border: "1px solid",
                borderColor: isListening ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.14)",
                background: isListening ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)",
                color: isListening ? "#fca5a5" : "#94a3b8",
                fontSize: "18px", cursor: "pointer", flexShrink: 0,
              }}>
                {isListening ? "🔴" : "🎤"}
              </button>
              <button onClick={() => handleSendMsg()} disabled={!msgInput.trim()} style={{
                padding: "10px 14px", borderRadius: "10px",
                border: "1px solid rgba(37,99,235,0.5)",
                background: msgInput.trim() ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.04)",
                color: msgInput.trim() ? "#93c5fd" : "#475569",
                fontSize: "15px", fontWeight: 900,
                cursor: msgInput.trim() ? "pointer" : "not-allowed", flexShrink: 0,
              }}>
                送信
              </button>
            </div>
            {/* アクションボタン行 */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => handleCall()} disabled={callPhase !== "idle"} style={{
                flex: 1, padding: "13px", borderRadius: "10px", border: "1px solid",
                borderColor: callPhase !== "idle" ? "rgba(255,255,255,0.1)" : "rgba(37,99,235,0.5)",
                background: callPhase !== "idle" ? "rgba(255,255,255,0.04)" : "rgba(37,99,235,0.2)",
                color: callPhase !== "idle" ? "#475569" : "#93c5fd",
                fontSize: "15px", fontWeight: 900, cursor: callPhase !== "idle" ? "not-allowed" : "pointer",
              }}>
                📞 管理者通話
              </button>
              <button onClick={() => setShowVehicleSelect(true)} disabled={callPhase !== "idle"} style={{
                flex: 1, padding: "13px", borderRadius: "10px", border: "1px solid",
                borderColor: callPhase !== "idle" ? "rgba(255,255,255,0.1)" : "rgba(16,185,129,0.5)",
                background: callPhase !== "idle" ? "rgba(255,255,255,0.04)" : "rgba(16,185,129,0.15)",
                color: callPhase !== "idle" ? "#475569" : "#6ee7b7",
                fontSize: "15px", fontWeight: 900, cursor: callPhase !== "idle" ? "not-allowed" : "pointer",
              }}>
                🚌 車両通話
              </button>
              <button onClick={() => setShowQuick(true)} style={{
                flex: 1, padding: "13px", borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#cbd5e1", fontSize: "15px", fontWeight: 900, cursor: "pointer",
              }}>
                📋 定型返信
              </button>
              <button onClick={() => {
                const pos = posRef.current;
                if (!pos) { toast.warning("現在地のGPS情報が取得できません"); return; }
                setTrafficQueryPos(pos);
                setShowTrafficModal(true);
              }} style={{
                flex: 1, padding: "13px", borderRadius: "10px",
                border: "1px solid rgba(251,146,60,0.4)",
                background: "rgba(251,146,60,0.12)",
                color: "#fb923c", fontSize: "15px", fontWeight: 900, cursor: "pointer",
              }}>
                🚦 道路状況
              </button>
              <button onClick={handleFullscreen} style={{
                padding: "13px 14px", borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#cbd5e1", fontSize: "16px", fontWeight: 900, cursor: "pointer",
              }}>
                ⛶
              </button>
            </div>
          </div>
        </section>

        {/* ===== 右ペイン: 運転支援 ===== */}
        <section style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{
            padding: "10px 14px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 900, fontSize: "18px" }}>🗺 運転支援</span>
            <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 700 }}>
              {config.routeId ? `路線: ${config.routeId}` : "路線未設定"}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {/* 現在時刻 */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 14px", borderRadius: "12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)", marginBottom: "7px",
            }}>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, marginBottom: "3px" }}>現在時刻</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
                  <span style={{ fontSize: "48px", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>{nowHM}</span>
                  <span style={{ fontSize: "26px", fontWeight: 700, color: "#94a3b8" }}>{nowSSStr}</span>
                </div>
              </div>
              <div style={{
                padding: "5px 12px", borderRadius: "20px",
                background: isGpsActive ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.15)",
                border: `1px solid ${isGpsActive ? "rgba(34,197,94,0.3)" : "rgba(100,116,139,0.3)"}`,
                color: isGpsActive ? "#4ade80" : "#94a3b8",
                fontSize: "13px", fontWeight: 700,
              }}>
                GPS {isGpsActive ? "OK" : "待機中"}
              </div>
            </div>

            {/* 直近通過停留所（GPS実績） */}
            <StopRow
              label="直近通過（GPS実績）"
              stopName={lastPassedStop?.stopName ?? null}
              hhmm={lastPassedStop?.hhmm ?? null}
              delayInfo={null}
              isHighlight={false}
              isPass={true}
            />

            {/* 次の停留所（ハイライト・早発警告） */}
            <StopRow
              label="次の停留所"
              stopName={nextStop?.stopName ?? null}
              hhmm={nextStop?.hhmm ?? null}
              delayInfo={nextStop ? calcDelayStr(nextStop) : null}
              isHighlight={true}
              isPass={false}
              isWarning={earlyWarning}
            />

            {/* 次々の停留所 */}
            <StopRow
              label="次々の停留所"
              stopName={next2Stop?.stopName ?? null}
              hhmm={next2Stop?.hhmm ?? null}
              delayInfo={next2Stop ? calcDelayStr(next2Stop) : null}
              isHighlight={false}
              isPass={false}
            />

            {/* その次の停留所 */}
            <StopRow
              label="その次の停留所"
              stopName={next3Stop?.stopName ?? null}
              hhmm={next3Stop?.hhmm ?? null}
              delayInfo={next3Stop ? calcDelayStr(next3Stop) : null}
              isHighlight={false}
              isPass={false}
            />

            {sortedRows.length === 0 && (
              <div style={{ color: "#475569", textAlign: "center", padding: "30px 10px", fontSize: "14px", lineHeight: 1.6 }}>
                時刻表データがありません<br />
                <span style={{ fontSize: "12px" }}>管理PCからダイヤを作成してください</span>
              </div>
            )}

            {/* 設定値インジケーター */}
            {settingsMap && (
              <div style={{
                fontSize: "11px", color: "#334155", padding: "6px 4px",
                lineHeight: 1.8, marginTop: "8px",
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}>
                停留所判定: {getSetting("stop_detection_radius_m", 30)}m ／
                早発距離: {getSetting("early_departure_distance_m", 300)}m ／
                早発秒数: {getSetting("early_departure_seconds", 20)}秒 ／
                GPS送信: {getSetting("gps_internal_interval_sec", 2)}秒毎
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 定型返信モーダル */}
      {showQuick && (
        <div onClick={() => setShowQuick(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "min(460px, 96vw)", background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px", overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontWeight: 900, fontSize: "17px" }}>📋 定型返信</span>
              <button onClick={() => setShowQuick(false)} style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: "7px", color: "#94a3b8", padding: "5px 10px",
                cursor: "pointer", fontSize: "13px", fontWeight: 700,
              }}>
                閉じる
              </button>
            </div>
            <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "60vh", overflowY: "auto" }}>
              {(quickRepliesData && (quickRepliesData as any[]).length > 0 ? (quickRepliesData as any[]) : []).map((qr: any) => (
                <button key={qr.id} onClick={() => handleQuickReply(qr.content)} style={{
                  padding: "14px 16px", borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#e2e8f0", fontSize: "16px", fontWeight: 700,
                  cursor: "pointer", textAlign: "left",
                }}>
                  {qr.content}
                </button>
              ))}
              {(!quickRepliesData || (quickRepliesData as any[]).length === 0) && (
                <div style={{ color: "#475569", textAlign: "center", padding: "20px", fontSize: "14px" }}>
                  定型返信が設定されていません<br />
                  <span style={{ fontSize: "12px" }}>管理PCから設定してください</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 車両選択モーダル（車両間通話） */}
      {showVehicleSelect && (
        <div onClick={() => setShowVehicleSelect(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "min(460px, 96vw)", background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px", overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontWeight: 900, fontSize: "17px" }}>🚌 車両を選択</span>
              <button onClick={() => setShowVehicleSelect(false)} style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: "7px", color: "#94a3b8", padding: "5px 10px",
                cursor: "pointer", fontSize: "13px", fontWeight: 700,
              }}>
                閉じる
              </button>
            </div>
            <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "60vh", overflowY: "auto" }}>
              {((allDeviceStates as any[]) ?? [])
                .filter((d: any) => d.deviceId !== config.deviceId && d.isOnline)
                .map((d: any) => (
                  <button key={d.deviceId} onClick={() => handleCall(d.deviceId, d.driverName ?? d.vehicleNo ?? d.deviceId)} style={{
                    padding: "14px 16px", borderRadius: "10px",
                    border: "1px solid rgba(16,185,129,0.3)",
                    background: "rgba(16,185,129,0.08)",
                    color: "#e2e8f0", fontSize: "15px", fontWeight: 700,
                    cursor: "pointer", textAlign: "left",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>🚌 {d.vehicleNo ?? d.deviceId}</span>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>{d.driverName ?? ""}</span>
                  </button>
                ))}
              {((allDeviceStates as any[]) ?? []).filter((d: any) => d.deviceId !== config.deviceId && d.isOnline).length === 0 && (
                <div style={{ color: "#475569", textAlign: "center", padding: "20px", fontSize: "14px" }}>
                  オンラインの他車両がありません
                </div>
              )}
             </div>
          </div>
        </div>
      )}
      {/* 道路状況モーダル */}
      {showTrafficModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000,
        }}>
          <div style={{
            background: "#1e293b", borderRadius: "16px", width: "min(90vw, 520px)",
            maxHeight: "80vh", display: "flex", flexDirection: "column",
            border: "1px solid rgba(251,146,60,0.3)",
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ color: "#fb923c", fontWeight: 900, fontSize: "18px" }}>🚦 道路状況（3km圏内）</span>
              <button onClick={() => setShowTrafficModal(false)} style={{
                background: "none", border: "none", color: "#94a3b8", fontSize: "22px", cursor: "pointer",
              }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {trafficFetching ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: "30px" }}>取得中...</div>
              ) : trafficData?.source === "none" ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: "20px", fontSize: "14px" }}>
                  <div style={{ marginBottom: "8px" }}>⚠️ HERE Traffic APIキー未設定</div>
                  <div>システム設定でHERE_API_KEYを設定してください</div>
                </div>
              ) : trafficData?.source === "error" ? (
                <div style={{ color: "#f87171", textAlign: "center", padding: "20px", fontSize: "14px" }}>
                  ❌ 取得エラー: {trafficData.message}
                </div>
              ) : (trafficData?.incidents?.length ?? 0) === 0 ? (
                <div style={{ color: "#4ade80", textAlign: "center", padding: "20px", fontSize: "15px" }}>
                  ✅ 3km圏内に渋滞・事故・通行止め情報はありません
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(trafficData?.incidents ?? []).map((inc: { id: string; type: string; description: string; startTime: string | null; endTime: string | null; severity: number; location: unknown }, i: number) => {
                    const typeLabel: Record<string, string> = {
                      ACCIDENT: "🚨 事故", CONGESTION: "🚗 渋滞", ROAD_CLOSURE: "🚧 通行止め",
                      CONSTRUCTION: "🔨 工事", DISABLED_VEHICLE: "🚗 車両故障", MASS_TRANSIT: "🚌 交通障害",
                    };
                    const label = typeLabel[inc.type] ?? `⚠️ ${inc.type}`;
                    return (
                      <div key={inc.id || i} style={{
                        background: "rgba(255,255,255,0.05)", borderRadius: "10px",
                        padding: "12px 14px", border: "1px solid rgba(251,146,60,0.2)",
                      }}>
                        <div style={{ color: "#fb923c", fontWeight: 700, marginBottom: "4px" }}>{label}</div>
                        <div style={{ color: "#e2e8f0", fontSize: "14px" }}>{inc.description || "詳細情報なし"}</div>
                        {inc.startTime && (
                          <div style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}>
                            発生: {new Date(inc.startTime).toLocaleString("ja-JP")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: "10px" }}>
              <button onClick={() => refetchTraffic()} style={{
                flex: 1, padding: "11px", borderRadius: "8px",
                border: "1px solid rgba(251,146,60,0.4)",
                background: "rgba(251,146,60,0.1)", color: "#fb923c",
                fontSize: "14px", fontWeight: 700, cursor: "pointer",
              }}>🔄 再取得</button>
              {(trafficData?.incidents?.length ?? 0) > 0 && (
                <button onClick={() => {
                  const summary = (trafficData?.incidents ?? []).map((inc: { type: string; description: string }) => {
                    const typeLabel: Record<string, string> = {
                      ACCIDENT: "事故", CONGESTION: "渋滞", ROAD_CLOSURE: "通行止め",
                      CONSTRUCTION: "工事", DISABLED_VEHICLE: "車両故障", MASS_TRANSIT: "交通障害",
                    };
                    return `[${typeLabel[inc.type] ?? inc.type}] ${inc.description || "詳細なし"}`;
                  }).join(" / ");
                  const msg = `【道路状況】現在地3km圏内: ${summary}`;
                  sendMsgMut.mutate({
                    senderId: config?.deviceId ?? "tablet",
                    senderType: "tablet" as const,
                    content: msg, receiverId: "admin",
                    senderName: config?.driverName ?? config?.deviceId ?? "運転士",
                  }, {
                    onSuccess: () => {
                      toast.success("道路状況を管理者に送信しました");
                      setShowTrafficModal(false);
                    },
                  });
                }} style={{
                  flex: 2, padding: "11px", borderRadius: "8px",
                  border: "1px solid rgba(37,99,235,0.5)",
                  background: "rgba(37,99,235,0.15)", color: "#93c5fd",
                  fontSize: "14px", fontWeight: 700, cursor: "pointer",
                }}>📨 管理者に送信</button>
              )}
              <button onClick={() => setShowTrafficModal(false)} style={{
                flex: 1, padding: "11px", borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)", color: "#94a3b8",
                fontSize: "14px", fontWeight: 700, cursor: "pointer",
              }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ==================== 停留所行コンポーネント ====================
function StopRow({
  label, stopName, hhmm, delayInfo, isHighlight, isPass, isWarning,
}: {
  label: string;
  stopName: string | null;
  hhmm: string | null;
  delayInfo: { text: string; isDelay: boolean } | null;
  isHighlight: boolean;
  isPass: boolean;
  isWarning?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 14px", borderRadius: "12px",
      background: isWarning
        ? "rgba(239,68,68,0.15)"
        : isHighlight ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.03)",
      border: "1px solid",
      borderColor: isWarning
        ? "rgba(239,68,68,0.6)"
        : isHighlight ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.06)",
      marginBottom: "7px", minHeight: "72px",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, marginBottom: "3px" }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{
            fontSize: isHighlight ? "26px" : "22px",
            fontWeight: isHighlight ? 900 : 800,
            color: isWarning ? "#fca5a5" : isHighlight ? "#93c5fd" : "#e2e8f0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {stopName ?? (isPass ? "GPS待機中" : "未選択")}
          </span>
          {hhmm && (
            <span style={{
              fontSize: isHighlight ? "30px" : "26px", fontWeight: 900,
              color: isHighlight ? "#bfdbfe" : "#94a3b8", flexShrink: 0,
            }}>
              {hhmm}
            </span>
          )}
        </div>
      </div>
      {delayInfo && (
        <div style={{
          padding: "5px 12px", borderRadius: "20px",
          background: delayInfo.isDelay ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
          border: "1px solid",
          borderColor: delayInfo.isDelay ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)",
          color: delayInfo.isDelay ? "#f87171" : "#4ade80",
          fontSize: "14px", fontWeight: 900,
          flexShrink: 0, marginLeft: "10px", textAlign: "right",
        }}>
          {delayInfo.text}
        </div>
      )}
    </div>
  );
}
