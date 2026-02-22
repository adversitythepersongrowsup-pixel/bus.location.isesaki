import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSSE } from "../hooks/useSSE";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leafletのデフォルトアイコン修正
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ==================== 型定義 ====================
interface ArrivalItem {
  vehicleNo: string;
  scheduledTime: string;
  estimatedTime: string;
  delayMinutes: number;
  isApproaching: boolean;
  approachingDesc: string | null;
}

// ==================== カスタムアイコン ====================
function createBusIcon(delay: number, isApproaching: boolean) {
  const color = delay <= 0 ? "#22c55e" : delay <= 3 ? "#eab308" : delay <= 10 ? "#f97316" : "#ef4444";
  const pulse = isApproaching ? `
    <circle cx="20" cy="20" r="18" fill="${color}" fill-opacity="0.15">
      <animate attributeName="r" values="14;20;14" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="fill-opacity" values="0.3;0;0.3" dur="1.5s" repeatCount="indefinite"/>
    </circle>
  ` : "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      ${pulse}
      <circle cx="22" cy="22" r="16" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="2.5"/>
      <text x="22" y="29" text-anchor="middle" font-size="20">🚌</text>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

function createStopIcon(isSelected: boolean) {
  const color = isSelected ? "#3b82f6" : "#64748b";
  const size = isSelected ? 32 : 24;
  const r = isSelected ? 12 : 9;
  const cr = isSelected ? 5 : 4;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="${isSelected ? 2.5 : 2}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${cr}" fill="${color}"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2],
  });
}

// ==================== 地図センタリングコンポーネント ====================
function MapCenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom ?? map.getZoom(), { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

// ==================== ユーティリティ ====================
function getDelayColor(delay: number): string {
  if (delay <= 0) return "#22c55e";
  if (delay <= 3) return "#eab308";
  if (delay <= 10) return "#f97316";
  return "#ef4444";
}

function getDelayLabel(delay: number): string {
  if (delay <= 0) return "定刻";
  return `+${delay}分`;
}

function getNoticeTypeLabel(type: string): { label: string; color: string; bg: string } {
  switch (type) {
    case "cancel": return { label: "運休", color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
    case "delay":  return { label: "遅延", color: "#f97316", bg: "rgba(249,115,22,0.12)" };
    case "detour": return { label: "迂回", color: "#a855f7", bg: "rgba(168,85,247,0.12)" };
    case "info":   return { label: "お知らせ", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" };
    default:       return { label: "その他", color: "#64748b", bg: "rgba(100,116,139,0.12)" };
  }
}

// ==================== メインコンポーネント ====================
export default function Busloc() {
  const [, setLocation] = useLocation();
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [selectedStopId, setSelectedStopId] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(new Date());
  // スマホ向けタブ: "map" | "arrivals" | "notices"
  const [activeTab, setActiveTab] = useState<"map" | "arrivals" | "notices">("arrivals");
  // 地図センタリング用
  const [mapTarget, setMapTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  // 停留所検索
  const [stopSearch, setStopSearch] = useState("");
  const [showStopList, setShowStopList] = useState(false);

  // 時計
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 公開用API
  const { data: routes, isLoading: loadingRoutes } = trpc.publicBusloc.getRoutes.useQuery();
  const { data: stops, isLoading: loadingStops } = trpc.publicBusloc.getStops.useQuery(
    { routeId: selectedRouteId },
    { enabled: !!selectedRouteId }
  );
  const { data: arrivalData, isLoading: loadingArrivals, refetch: refetchArrivals } = trpc.publicBusloc.getArrivals.useQuery(
    { routeId: selectedRouteId, stopId: selectedStopId },
    { enabled: !!selectedRouteId && !!selectedStopId, refetchInterval: 30000 }
  );
  const { data: notices, refetch: refetchNotices } = trpc.publicBusloc.getNotices.useQuery(
    { routeId: selectedRouteId || undefined, stopId: selectedStopId || undefined },
    { enabled: !!selectedRouteId, refetchInterval: 60000 }
  );

  // 公開用バス位置情報（個人情報なし）
  const { data: deviceStates } = trpc.publicBusloc.getBusPositions.useQuery(
    undefined,
    { refetchInterval: 10000 }
  );

  // SSEリアルタイム受信
  const selectedRouteIdRef = useRef(selectedRouteId);
  selectedRouteIdRef.current = selectedRouteId;
  const selectedStopIdRef = useRef(selectedStopId);
  selectedStopIdRef.current = selectedStopId;

  const handleSSEMessage = useCallback((data: unknown) => {
    const msg = data as any;
    if (msg._type === "notice_updated") {
      refetchNotices();
    } else if (msg._type === "arrival_updated") {
      if (!msg.routeId || msg.routeId === selectedRouteIdRef.current) {
        refetchArrivals();
      }
    }
  }, [refetchNotices, refetchArrivals]);

  useSSE({ enabled: true, onMessage: handleSSEMessage });

  // 路線の最初の停留所を自動選択
  useEffect(() => {
    if (routes && routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].routeId);
    }
  }, [routes, selectedRouteId]);

  useEffect(() => {
    if (stops && stops.length > 0 && !selectedStopId) {
      setSelectedStopId(stops[0].stopId);
    }
    if (stops && stops.length > 0 && selectedStopId) {
      const found = stops.find((s: any) => s.stopId === selectedStopId);
      if (!found) setSelectedStopId(stops[0].stopId);
    }
  }, [stops]);

  // 停留所選択時に地図をセンタリング
  useEffect(() => {
    if (!stops || !selectedStopId) return;
    const stop = stops.find((s: any) => s.stopId === selectedStopId);
    if (stop && stop.stopLat && stop.stopLon) {
      const lat = parseFloat(stop.stopLat);
      const lng = parseFloat(stop.stopLon);
      if (!isNaN(lat) && !isNaN(lng)) {
        setMapTarget({ lat, lng, zoom: 16 });
      }
    }
  }, [selectedStopId, stops]);

  const arrivals: ArrivalItem[] = (arrivalData?.arrivals ?? []) as ArrivalItem[];
  const approachingBus = arrivals.find(a => a.isApproaching);

  // 地図の初期中心（日本中心）
  const mapCenter = useMemo<[number, number]>(() => [36.2048, 138.2529], []);

  // バス位置情報
  const busPositions = useMemo(() => {
    if (!deviceStates) return [];
    return (deviceStates as any[]).filter(ds =>
      ds.latitude && ds.longitude &&
      (!selectedRouteId || ds.routeId === selectedRouteId)
    );
  }, [deviceStates, selectedRouteId]);

  // 停留所フィルタ
  const filteredStops = useMemo(() => {
    if (!stops) return [];
    if (!stopSearch.trim()) return stops;
    return (stops as any[]).filter((s: any) =>
      s.stopName?.includes(stopSearch) || s.stopId?.includes(stopSearch)
    );
  }, [stops, stopSearch]);

  const selectedStop = useMemo(() =>
    (stops ?? []).find((s: any) => s.stopId === selectedStopId),
    [stops, selectedStopId]
  );

  const selectedRoute = useMemo(() =>
    (routes ?? []).find((r: any) => r.routeId === selectedRouteId),
    [routes, selectedRouteId]
  );

  // 停留所選択ハンドラ
  const handleSelectStop = useCallback((stopId: string) => {
    setSelectedStopId(stopId);
    setShowStopList(false);
    setStopSearch("");
    setActiveTab("arrivals");
  }, []);

  // ==================== スタイル定数 ====================
  const BG = "#0f172a";
  const SURFACE = "#1e293b";
  const BORDER = "rgba(255,255,255,0.08)";
  const TEXT = "#f1f5f9";
  const MUTED = "#64748b";
  const PRIMARY = "#3b82f6";

  return (
    <div style={{
      height: "100dvh",
      background: BG,
      color: TEXT,
      fontFamily: "'Noto Sans JP', 'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      WebkitTapHighlightColor: "transparent",
    }}>

      {/* ==================== ヘッダー ==================== */}
      <header style={{
        background: SURFACE,
        borderBottom: `1px solid ${BORDER}`,
        padding: "0 12px",
        height: "56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        gap: "8px",
        position: "relative",
        zIndex: 2000,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px", fontWeight: 900 }}>🚌</span>
          <span style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "-0.02em" }}>バスロケ</span>
        </div>

        {/* 路線選択 */}
        <select
          value={selectedRouteId}
          onChange={e => { setSelectedRouteId(e.target.value); setSelectedStopId(""); }}
          style={{
            flex: 1,
            maxWidth: "180px",
            background: "#0f172a",
            border: `1px solid ${selectedRouteId ? PRIMARY + "80" : BORDER}`,
            borderRadius: "10px",
            color: TEXT,
            padding: "8px 10px",
            fontSize: "14px",
            fontWeight: 700,
            WebkitAppearance: "none",
            appearance: "none",
          }}
        >
          <option value="">路線を選択...</option>
          {(routes ?? []).map((r: any) => (
            <option key={r.routeId} value={r.routeId}>{r.routeShortName}</option>
          ))}
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "13px", color: MUTED, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
            {currentTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={() => setLocation("/")}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${BORDER}`,
              borderRadius: "8px",
              color: MUTED,
              padding: "6px 10px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              minWidth: "44px",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
      </header>

      {/* ==================== 停留所選択バー ==================== */}
      <div style={{
        background: SURFACE,
        borderBottom: `1px solid ${BORDER}`,
        padding: "8px 12px",
        flexShrink: 0,
        position: "relative",
        zIndex: 1500,
      }}>
        <button
          onClick={() => setShowStopList(v => !v)}
          disabled={!selectedRouteId || loadingStops}
          style={{
            width: "100%",
            background: selectedStopId ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
            border: `1.5px solid ${selectedStopId ? PRIMARY + "60" : BORDER}`,
            borderRadius: "12px",
            color: selectedStopId ? TEXT : MUTED,
            padding: "12px 16px",
            fontSize: "15px",
            fontWeight: 700,
            cursor: (!selectedRouteId || loadingStops) ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: "left",
            opacity: (!selectedRouteId || loadingStops) ? 0.5 : 1,
            minHeight: "48px",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>📍</span>
            <span>
              {!selectedRouteId ? "← まず路線を選択" :
               loadingStops ? "読み込み中..." :
               selectedStop ? selectedStop.stopName :
               `停留所を選択（${(stops ?? []).length}件）`}
            </span>
          </span>
          <span style={{ color: MUTED, fontSize: "12px" }}>▼</span>
        </button>

        {/* 停留所ドロップダウン */}
        {showStopList && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: "12px",
            right: "12px",
            background: "#1a2744",
            border: `1px solid ${PRIMARY}40`,
            borderRadius: "14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 100,
            overflow: "hidden",
            maxHeight: "60vh",
            display: "flex",
            flexDirection: "column",
          }}>
            {/* 検索ボックス */}
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
              <input
                value={stopSearch}
                onChange={e => setStopSearch(e.target.value)}
                placeholder="停留所名を検索..."
                autoFocus
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: "8px",
                  color: TEXT,
                  padding: "10px 12px",
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {/* 停留所リスト */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filteredStops.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: MUTED, fontSize: "14px" }}>
                  該当する停留所がありません
                </div>
              ) : (
                filteredStops.map((s: any) => (
                  <button
                    key={s.stopId}
                    onClick={() => handleSelectStop(s.stopId)}
                    style={{
                      width: "100%",
                      background: s.stopId === selectedStopId ? "rgba(59,130,246,0.15)" : "transparent",
                      border: "none",
                      borderBottom: `1px solid ${BORDER}`,
                      color: s.stopId === selectedStopId ? PRIMARY : TEXT,
                      padding: "14px 16px",
                      fontSize: "15px",
                      fontWeight: s.stopId === selectedStopId ? 700 : 400,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      minHeight: "52px",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>
                      {s.stopId === selectedStopId ? "📍" : "○"}
                    </span>
                    <span>{s.stopName}</span>
                  </button>
                ))
              )}
            </div>
            {/* 閉じるボタン */}
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${BORDER}` }}>
              <button
                onClick={() => { setShowStopList(false); setStopSearch(""); }}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: "8px",
                  color: MUTED,
                  padding: "10px",
                  fontSize: "14px",
                  cursor: "pointer",
                  minHeight: "44px",
                }}
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== タブナビゲーション ==================== */}
      <div style={{
        background: SURFACE,
        borderBottom: `1px solid ${BORDER}`,
        display: "flex",
        flexShrink: 0,
        position: "relative",
        zIndex: 1500,
      }}>
        {(["arrivals", "map", "notices"] as const).map(tab => {
          const labels: Record<string, string> = {
            arrivals: "🕐 到着予測",
            map: "🗺️ 地図",
            notices: `📢 お知らせ${notices && notices.length > 0 ? ` (${notices.length})` : ""}`,
          };
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: isActive ? `3px solid ${PRIMARY}` : "3px solid transparent",
                color: isActive ? PRIMARY : MUTED,
                padding: "12px 4px",
                fontSize: "13px",
                fontWeight: isActive ? 700 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                minHeight: "48px",
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ==================== コンテンツエリア ==================== */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

        {/* ---- 到着予測タブ ---- */}
        {activeTab === "arrivals" && (
          <div style={{ height: "100%", overflowY: "auto", padding: "12px" }}>

            {/* 接近中バスのお知らせ */}
            {approachingBus && (
              <div style={{
                marginBottom: "12px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "rgba(59,130,246,0.15)",
                border: `1.5px solid rgba(59,130,246,0.5)`,
                animation: "pulse 2s infinite",
              }}>
                <div style={{ fontSize: "13px", color: "#93c5fd", fontWeight: 800, marginBottom: "4px" }}>
                  🔔 まもなく到着
                </div>
                <div style={{ fontSize: "17px", fontWeight: 900, color: TEXT }}>
                  {approachingBus.approachingDesc ?? `${approachingBus.vehicleNo} が接近中です`}
                </div>
                <div style={{ fontSize: "14px", color: "#93c5fd", marginTop: "4px" }}>
                  予定: {approachingBus.estimatedTime}
                  {approachingBus.delayMinutes > 0 && (
                    <span style={{ color: "#f97316", marginLeft: "8px" }}>
                      ({getDelayLabel(approachingBus.delayMinutes)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 到着予測リスト */}
            <div style={{ marginBottom: "8px", fontSize: "12px", color: MUTED, fontWeight: 700 }}>
              到着予測（最大3本）
            </div>

            {!selectedStopId ? (
              <div style={{
                textAlign: "center",
                padding: "40px 20px",
                color: MUTED,
                fontSize: "15px",
                lineHeight: 1.8,
              }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>📍</div>
                上の「停留所を選択」から<br />停留所を選んでください
              </div>
            ) : loadingArrivals ? (
              <div style={{ textAlign: "center", padding: "40px", color: MUTED }}>
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
                読み込み中...
              </div>
            ) : arrivals.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "40px 20px",
                color: MUTED,
                fontSize: "14px",
                lineHeight: 1.8,
                background: "rgba(255,255,255,0.03)",
                borderRadius: "14px",
              }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🚌</div>
                現在、到着予測データがありません。<br />
                <span style={{ fontSize: "12px" }}>バスが運行を開始すると表示されます</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {arrivals.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      background: a.isApproaching ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${a.isApproaching ? "rgba(59,130,246,0.4)" : BORDER}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{
                          width: "28px", height: "28px",
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.1)",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: "13px", fontWeight: 900, color: "#94a3b8",
                          flexShrink: 0,
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ fontSize: "28px", fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                          {a.estimatedTime}
                        </span>
                      </div>
                      <span style={{
                        fontSize: "14px", fontWeight: 800,
                        color: getDelayColor(a.delayMinutes),
                        background: `${getDelayColor(a.delayMinutes)}18`,
                        border: `1px solid ${getDelayColor(a.delayMinutes)}40`,
                        borderRadius: "10px",
                        padding: "4px 12px",
                      }}>
                        {getDelayLabel(a.delayMinutes)}
                      </span>
                    </div>
                    {a.scheduledTime !== a.estimatedTime && (
                      <div style={{ fontSize: "13px", color: MUTED, marginTop: "6px" }}>
                        定刻: {a.scheduledTime}
                      </div>
                    )}
                    {a.isApproaching && (
                      <div style={{ fontSize: "13px", color: "#93c5fd", marginTop: "6px", fontWeight: 700 }}>
                        🔔 接近中
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 更新時刻 */}
            {arrivalData?.updatedAt && (
              <div style={{ padding: "12px 4px", fontSize: "11px", color: "#475569", textAlign: "right" }}>
                最終更新: {new Date(arrivalData.updatedAt).toLocaleTimeString("ja-JP")}
              </div>
            )}
          </div>
        )}

        {/* ---- 地図タブ ---- */}
        {activeTab === "map" && (
          <div style={{ height: "100%", position: "relative", isolation: "isolate", zIndex: 0 }}>
            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ width: "100%", height: "100%" }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* 地図センタリング */}
              {mapTarget && <MapCenter lat={mapTarget.lat} lng={mapTarget.lng} zoom={mapTarget.zoom} />}

              {/* 停留所マーカー */}
              {(stops ?? []).map((s: any) => {
                if (!s.stopLat || !s.stopLon) return null;
                const lat = parseFloat(s.stopLat);
                const lng = parseFloat(s.stopLon);
                if (isNaN(lat) || isNaN(lng)) return null;
                const isSelected = s.stopId === selectedStopId;
                return (
                  <Marker
                    key={s.stopId}
                    position={[lat, lng]}
                    icon={createStopIcon(isSelected)}
                    eventHandlers={{
                      click: () => {
                        setSelectedStopId(s.stopId);
                        setActiveTab("arrivals");
                      }
                    }}
                  >
                    <Popup>
                      <div style={{ fontFamily: "'Noto Sans JP', sans-serif", minWidth: "120px" }}>
                        <strong style={{ fontSize: "14px" }}>{s.stopName}</strong>
                        <div style={{ marginTop: "6px" }}>
                          <button
                            onClick={() => { setSelectedStopId(s.stopId); setActiveTab("arrivals"); }}
                            style={{
                              background: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              padding: "4px 10px",
                              fontSize: "12px",
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                          >
                            到着予測を見る
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* バスマーカー */}
              {busPositions.map((ds: any) => {
                const lat = parseFloat(ds.latitude);
                const lng = parseFloat(ds.longitude);
                if (isNaN(lat) || isNaN(lng)) return null;
                const delay = ds.delayMinutes ?? 0;
                const isApproaching = arrivals.some(a => a.vehicleNo === ds.vehicleNo && a.isApproaching);
                return (
                  <Marker
                    key={ds.deviceId}
                    position={[lat, lng]}
                    icon={createBusIcon(delay, isApproaching)}
                  >
                    <Popup>
                      <div style={{ fontFamily: "'Noto Sans JP', sans-serif", minWidth: "120px" }}>
                        <div style={{ fontWeight: 900, marginBottom: "4px", fontSize: "14px" }}>🚌 バス</div>
                        {ds.currentStopName && (
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            現在: {ds.currentStopName}
                          </div>
                        )}
                        <div style={{
                          fontSize: "13px", fontWeight: 800,
                          color: getDelayColor(delay),
                          marginTop: "4px",
                        }}>
                          {getDelayLabel(delay)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* 凡例（地図上に重ねて表示） */}
            <div style={{
              position: "absolute",
              bottom: "16px",
              right: "8px",
              background: "rgba(15,23,42,0.88)",
              backdropFilter: "blur(8px)",
              border: `1px solid ${BORDER}`,
              borderRadius: "12px",
              padding: "10px 12px",
              fontSize: "11px",
              color: "#94a3b8",
              zIndex: 1000,
            }}>
              <div style={{ fontWeight: 800, marginBottom: "6px", color: TEXT, fontSize: "12px" }}>凡例</div>
              {[
                { color: "#22c55e", label: "定刻" },
                { color: "#eab308", label: "1〜3分遅れ" },
                { color: "#f97316", label: "4〜10分遅れ" },
                { color: "#ef4444", label: "10分超遅れ" },
                { color: "#3b82f6", label: "選択中停留所" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }}></span>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* 選択中停留所バッジ（地図上） */}
            {selectedStop && (
              <div style={{
                position: "absolute",
                top: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(15,23,42,0.92)",
                border: `1.5px solid ${PRIMARY}60`,
                borderRadius: "20px",
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 700,
                color: TEXT,
                zIndex: 1000,
                backdropFilter: "blur(8px)",
                whiteSpace: "nowrap",
                maxWidth: "80vw",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                📍 {(selectedStop as any).stopName}
              </div>
            )}
          </div>
        )}

        {/* ---- お知らせタブ ---- */}
        {activeTab === "notices" && (
          <div style={{ height: "100%", overflowY: "auto", padding: "12px" }}>
            {!selectedRouteId ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED, fontSize: "15px" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>📢</div>
                路線を選択してください
              </div>
            ) : !notices || notices.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "40px 20px",
                color: MUTED,
                fontSize: "14px",
                lineHeight: 1.8,
                background: "rgba(255,255,255,0.03)",
                borderRadius: "14px",
              }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
                現在、運行情報・お知らせはありません
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {notices.map((n: any) => {
                  const typeInfo = getNoticeTypeLabel(n.noticeType);
                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "14px",
                        background: typeInfo.bg,
                        border: `1.5px solid ${typeInfo.color}40`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{
                          fontSize: "12px", fontWeight: 900,
                          color: typeInfo.color,
                          background: `${typeInfo.color}20`,
                          border: `1px solid ${typeInfo.color}40`,
                          borderRadius: "8px",
                          padding: "2px 8px",
                          flexShrink: 0,
                        }}>
                          {typeInfo.label}
                        </span>
                        <span style={{ fontSize: "15px", fontWeight: 800, color: TEXT }}>
                          {n.title}
                        </span>
                      </div>
                      <div style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.6 }}>
                        {n.content}
                      </div>
                      {n.startAt && (
                        <div style={{ fontSize: "11px", color: MUTED, marginTop: "8px" }}>
                          {new Date(n.startAt).toLocaleDateString("ja-JP")}〜
                          {n.endAt ? new Date(n.endAt).toLocaleDateString("ja-JP") : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== フッター（路線名・停留所名の確認バー） ==================== */}
      {selectedStopId && activeTab !== "map" && (
        <div style={{
          background: SURFACE,
          borderTop: `1px solid ${BORDER}`,
          padding: "8px 12px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}>
          <div style={{ fontSize: "12px", color: MUTED }}>
            {selectedRoute?.routeShortName ?? selectedRouteId}
          </div>
          <button
            onClick={() => setActiveTab("map")}
            style={{
              background: "rgba(59,130,246,0.1)",
              border: `1px solid ${PRIMARY}40`,
              borderRadius: "8px",
              color: PRIMARY,
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              minHeight: "36px",
            }}
          >
            🗺️ 地図で確認
          </button>
        </div>
      )}
    </div>
  );
}
