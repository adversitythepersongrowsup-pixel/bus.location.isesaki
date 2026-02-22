import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";

const SETUP_STORAGE_KEY = "bus_operation_setup";

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

function getStoredConfig(): SetupConfig | null {
  try {
    const stored = localStorage.getItem(SETUP_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function saveConfig(config: SetupConfig) {
  localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(config));
}

type Tab = "route" | "dia" | "vehicle" | "driver";

const TABS: { id: Tab; label: string; emoji: string; color: string }[] = [
  { id: "route",   label: "系統",    emoji: "🗺",  color: "#d97706" },
  { id: "dia",     label: "ダイヤ",  emoji: "📅",  color: "#2563eb" },
  { id: "vehicle", label: "車両番号", emoji: "🚌",  color: "#059669" },
  { id: "driver",  label: "乗務員",  emoji: "👤",  color: "#7c3aed" },
];

export default function Setup() {
  const [, setLocation] = useLocation();
  const stored = getStoredConfig();

  const [activeTab, setActiveTab] = useState<Tab>("route");
  const [routeId, setRouteId] = useState(stored?.routeId ?? "");
  const [diaId, setDiaId] = useState<string>(stored?.diaId?.toString() ?? "");
  const [vehicleId, setVehicleId] = useState<string>(stored?.vehicleId?.toString() ?? "");
  const [driverId, setDriverId] = useState<string>(stored?.driverId?.toString() ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // API
  const { data: routesList, isLoading: loadingRoutes } = trpc.gtfs.getRoutes.useQuery();
  const { data: linesList } = trpc.line.getAll.useQuery();
  const { data: groupedDias, isLoading: loadingDias } = trpc.dia.listGrouped.useQuery();
  const { data: activeVehicles, isLoading: loadingVehicles } = trpc.vehicle.active.useQuery();
  const { data: activeDrivers, isLoading: loadingDrivers } = trpc.driver.active.useQuery();
  const upsertMut = trpc.device.upsert.useMutation();
  const applyShiftMut = trpc.deviceState.applyShift.useMutation();

  // 選択中のオブジェクト
  const selectedRoute = useMemo(() => routesList?.find((r: any) => r.routeId === routeId), [routesList, routeId]);
  const selectedRouteGroup = useMemo(() => groupedDias?.find((g: any) => g.routeId === routeId) ?? null, [groupedDias, routeId]);
  const weekdayDias = useMemo(() => (selectedRouteGroup as any)?.weekday?.filter((d: any) => d.isActive) ?? [], [selectedRouteGroup]);
  const holidayDias = useMemo(() => (selectedRouteGroup as any)?.holiday?.filter((d: any) => d.isActive) ?? [], [selectedRouteGroup]);
  const allDias = useMemo(() => [...weekdayDias, ...holidayDias], [weekdayDias, holidayDias]);
  const selectedDia = useMemo(() => allDias.find((d: any) => d.id.toString() === diaId), [allDias, diaId]);
  const selectedVehicle = useMemo(() => activeVehicles?.find((v: any) => v.id.toString() === vehicleId), [activeVehicles, vehicleId]);
  const selectedDriver = useMemo(() => activeDrivers?.find((d: any) => d.id.toString() === driverId), [activeDrivers, driverId]);

  const deviceId = useMemo(() => {
    const parts: string[] = [];
    if (selectedVehicle) parts.push((selectedVehicle as any).vehicleNumber);
    if (selectedDriver) parts.push((selectedDriver as any).driverCode ?? `D${(selectedDriver as any).id}`);
    return parts.length > 0 ? `tablet-${parts.join("-")}` : `tablet-${Date.now()}`;
  }, [selectedVehicle, selectedDriver]);

  const stepDone: Record<Tab, boolean> = {
    route: !!routeId,
    dia: !!diaId,
    vehicle: !!vehicleId,
    driver: !!driverId,
  };

  const canApply = !!vehicleId && !!driverId;

  const handleRouteChange = (newRouteId: string) => {
    setRouteId(newRouteId);
    setDiaId("");
  };

  const handleApply = async () => {
    if (!vehicleId) { toast.error("車両番号を選択してください"); setActiveTab("vehicle"); return; }
    if (!driverId) { toast.error("乗務員を選択してください"); setActiveTab("driver"); return; }
    setIsSaving(true);

    const config: SetupConfig = {
      deviceId,
      driverName: (selectedDriver as any)?.driverName ?? "",
      driverId: driverId ? parseInt(driverId) : null,
      vehicleNumber: (selectedVehicle as any)?.vehicleNumber ?? "",
      vehicleId: vehicleId ? parseInt(vehicleId) : null,
      routeId,
      diaId: diaId ? parseInt(diaId) : null,
      savedAt: new Date().toISOString(),
    };
    saveConfig(config);

    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("initialSetupDate", today);

    try {
      await applyShiftMut.mutateAsync({
        deviceId,
        serviceDate: today,
        routeId: routeId || "",
        diaId: diaId || "",
        vehicleNo: (selectedVehicle as any)?.vehicleNumber ?? "",
        driverName: (selectedDriver as any)?.driverName ?? "",
        shiftConfirmed: true,
        shiftConfirmedDate: today,
      });
      await upsertMut.mutateAsync({
        deviceId,
        deviceName: (selectedDriver as any)?.driverName ?? undefined,
        deviceType: "tablet",
        routeId: routeId || undefined,
        vehicleId: (selectedVehicle as any)?.vehicleNumber ?? undefined,
        diaId: diaId ? parseInt(diaId) : undefined,
        displayMode: "normal",
        autoStart: true,
      });
      toast.success("設定を反映しました。運転支援画面を開きます");
      setTimeout(() => setLocation("/tablet"), 700);
    } catch {
      toast.error("サーバーへの反映に失敗しました（ローカルには保存済み）");
      setTimeout(() => setLocation("/tablet"), 700);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem(SETUP_STORAGE_KEY);
    setRouteId(""); setDiaId(""); setVehicleId(""); setDriverId("");
    setActiveTab("route");
    toast.info("設定をリセットしました");
  };

  // 現在タブのアクセントカラー
  const currentTab = TABS.find(t => t.id === activeTab)!;

  return (
    <div style={{
      height: "100dvh",
      background: "#0f172a",
      color: "#f1f5f9",
      fontFamily: "'Noto Sans JP', 'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ===== ヘッダー ===== */}
      <header style={{
        background: "#1e293b",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "0 20px",
        height: "52px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px", fontWeight: 900 }}>⚙ 初期設定</span>
          <span style={{ fontSize: "12px", color: "#64748b" }}>路線・ダイヤ・車両・乗務員を選択</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setLocation("/tablet")} style={{
            background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.4)",
            borderRadius: "8px", color: "#93c5fd", padding: "6px 14px",
            fontSize: "13px", fontWeight: 800, cursor: "pointer",
          }}>🚌 運転支援へ</button>
          <button onClick={handleReset} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px", color: "#64748b", padding: "6px 12px",
            fontSize: "13px", fontWeight: 700, cursor: "pointer",
          }}>🔄 リセット</button>
        </div>
      </header>

      {/* ===== メインレイアウト（左タブ＋右コンテンツ） ===== */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* 左サイドタブ */}
        <nav style={{
          width: "160px",
          background: "#1e293b",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          padding: "12px 10px",
          gap: "6px",
          flexShrink: 0,
        }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDone = stepDone[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: "100%",
                  padding: "14px 10px",
                  borderRadius: "12px",
                  border: isActive
                    ? `2px solid ${tab.color}`
                    : "2px solid transparent",
                  background: isActive
                    ? `${tab.color}22`
                    : isDone ? "rgba(255,255,255,0.04)" : "transparent",
                  color: isActive ? "#f1f5f9" : isDone ? "#94a3b8" : "#475569",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s",
                  position: "relative",
                }}
              >
                {/* 完了バッジ */}
                {isDone && (
                  <div style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: tab.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 900,
                    color: "#fff",
                  }}>✓</div>
                )}
                <span style={{ fontSize: "26px", lineHeight: 1 }}>{tab.emoji}</span>
                <span style={{
                  fontSize: "13px",
                  fontWeight: isActive ? 900 : 700,
                  color: isActive ? tab.color : isDone ? "#94a3b8" : "#475569",
                }}>{tab.label}</span>
              </button>
            );
          })}

          {/* 区切り */}
          <div style={{ flex: 1 }} />

          {/* 選択状況ミニサマリー */}
          <div style={{
            padding: "10px 8px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
          }}>
            {TABS.map(tab => {
              const values: Record<Tab, string | null> = {
                route: (selectedRoute as any)?.routeShortName ?? null,
                dia: (selectedDia as any)?.diaName ?? null,
                vehicle: (selectedVehicle as any)?.vehicleNumber ?? null,
                driver: (selectedDriver as any)?.driverName ?? null,
              };
              const val = values[tab.id];
              return (
                <div key={tab.id} style={{
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  color: val ? "#94a3b8" : "#334155",
                  overflow: "hidden",
                }}>
                  <span style={{ flexShrink: 0 }}>{tab.emoji}</span>
                  <span style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: val ? tab.color : "#334155",
                    fontWeight: val ? 800 : 400,
                  }}>{val ?? "未選択"}</span>
                </div>
              );
            })}
          </div>
        </nav>

        {/* 右コンテンツエリア */}
        <main style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* コンテンツヘッダー */}
          <div style={{
            padding: "14px 20px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>{currentTab.emoji}</span>
              <div>
                <h2 style={{
                  fontSize: "18px",
                  fontWeight: 900,
                  color: currentTab.color,
                  margin: 0,
                }}>
                  {activeTab === "route" && "系統を選択"}
                  {activeTab === "dia" && "本日のダイヤを選択"}
                  {activeTab === "vehicle" && "車両番号を選択"}
                  {activeTab === "driver" && "乗務員名を選択"}
                </h2>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
                  {activeTab === "route" && "運行する系統を選択してください"}
                  {activeTab === "dia" && (routeId ? `路線: ${(selectedRoute as any)?.routeShortName ?? routeId}` : "先に路線を選択してください")}
                  {activeTab === "vehicle" && "本日使用する車両を選択してください"}
                  {activeTab === "driver" && "本日乗務する方を選択してください"}
                </p>
              </div>
            </div>
          </div>

          {/* リストエリア */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

            {/* ===== 系統タブ（路線名でグループ化） ===== */}
            {activeTab === "route" && (() => {
              const routesByLine = new Map<string, any[]>();
              for (const r of (routesList ?? [])) {
                const key = (r as any).lineId ?? "__none__";
                if (!routesByLine.has(key)) routesByLine.set(key, []);
                routesByLine.get(key)!.push(r);
              }
              const lineMap = new Map<string, string>();
              for (const l of (linesList ?? [])) lineMap.set((l as any).lineId, (l as any).lineName);
              const sortedLines = (linesList ?? []).map((l: any) => l.lineId);
              const allKeys = [...sortedLines, ...Array.from(routesByLine.keys()).filter(k => k === "__none__")];
              const uniqueKeys = Array.from(new Set(allKeys)).filter(k => routesByLine.has(k));
              return (
                <ListContent loading={loadingRoutes} emptyText="系統が登録されていません。GTFSデータを取り込むか、管理画面から登録してください。">
                  {uniqueKeys.map(key => {
                    const routes = routesByLine.get(key) ?? [];
                    const groupLabel = key === "__none__" ? "未分類" : (lineMap.get(key) ?? key);
                    return (
                      <div key={key} style={{ marginBottom: "8px" }}>
                        <SectionLabel label={`🚦 ${groupLabel}`} color="#d97706" count={routes.length} />
                        {routes.map((r: any) => (
                          <ListRow
                            key={r.routeId}
                            isSelected={routeId === r.routeId}
                            onClick={() => { handleRouteChange(r.routeId); setActiveTab("dia"); }}
                            primary={r.routeShortName ?? r.routeId}
                            secondary={r.routeLongName ?? r.routeId}
                            badge={r.routeId}
                            color="#d97706"
                            avatar="🗺"
                          />
                        ))}
                      </div>
                    );
                  })}
                </ListContent>
              );
            })()}

            {/* ===== ダイヤタブ ===== */}
            {activeTab === "dia" && (
              <ListContent
                loading={loadingDias}
                emptyText={!routeId ? "先に路線を選択してください。" : "この路線のダイヤがありません。管理画面からダイヤを作成してください。"}
              >
                {weekdayDias.length > 0 && (
                  <div style={{ marginBottom: "4px" }}>
                    <SectionLabel label="🗓 平日" color="#2563eb" count={weekdayDias.length} />
                    {weekdayDias.map((d: any) => (
                      <ListRow
                        key={d.id}
                        isSelected={diaId === d.id.toString()}
                        onClick={() => { setDiaId(d.id.toString()); setActiveTab("vehicle"); }}
                        primary={d.diaName}
                        secondary={d.description ?? ""}
                        badge="平日"
                        color="#2563eb"
                        avatar="🗓"
                      />
                    ))}
                  </div>
                )}
                {holidayDias.length > 0 && (
                  <div>
                    <SectionLabel label="🎌 土日祝" color="#dc2626" count={holidayDias.length} />
                    {holidayDias.map((d: any) => (
                      <ListRow
                        key={d.id}
                        isSelected={diaId === d.id.toString()}
                        onClick={() => { setDiaId(d.id.toString()); setActiveTab("vehicle"); }}
                        primary={d.diaName}
                        secondary={d.description ?? ""}
                        badge="土日祝"
                        color="#dc2626"
                        avatar="🎌"
                      />
                    ))}
                  </div>
                )}
              </ListContent>
            )}

            {/* ===== 車両タブ ===== */}
            {activeTab === "vehicle" && (
              <ListContent loading={loadingVehicles} emptyText="車両が登録されていません。管理画面から登録してください。">
                {(activeVehicles ?? []).map((v: any) => (
                  <ListRow
                    key={v.id}
                    isSelected={vehicleId === v.id.toString()}
                    onClick={() => { setVehicleId(v.id.toString()); setActiveTab("driver"); }}
                    primary={v.vehicleNumber}
                    secondary={v.vehicleName ?? ""}
                    badge={v.vehicleType ?? ""}
                    color="#059669"
                    avatar="🚌"
                  />
                ))}
              </ListContent>
            )}

            {/* ===== 乗務員タブ ===== */}
            {activeTab === "driver" && (
              <ListContent loading={loadingDrivers} emptyText="乗務員が登録されていません。管理画面から登録してください。">
                {[...(activeDrivers ?? [])].sort((a: any, b: any) => {
                  const ca = a.driverCode ?? "";
                  const cb = b.driverCode ?? "";
                  return ca.localeCompare(cb, undefined, { numeric: true, sensitivity: "base" });
                }).map((d: any) => (
                  <ListRow
                    key={d.id}
                    isSelected={driverId === d.id.toString()}
                    onClick={() => setDriverId(d.id.toString())}
                    primary={d.driverName}
                    secondary={d.driverCode ? `乗務員コード: ${d.driverCode}` : ""}
                    badge={d.driverCode ?? ""}
                    color="#7c3aed"
                    avatar={d.driverName.charAt(0)}
                  />
                ))}
              </ListContent>
            )}
          </div>
        </main>
      </div>

      {/* ===== フッター ===== */}
      <footer style={{
        background: "#1e293b",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexShrink: 0,
      }}>
        {/* 選択サマリーバッジ */}
        <div style={{ flex: 1, display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {TABS.map(tab => {
            const values: Record<Tab, string | null> = {
              route: (selectedRoute as any)?.routeShortName ?? null,
              dia: (selectedDia as any)?.diaName ?? null,
              vehicle: (selectedVehicle as any)?.vehicleNumber ?? null,
              driver: (selectedDriver as any)?.driverName ?? null,
            };
            const val = values[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  background: val ? `${tab.color}18` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${val ? `${tab.color}40` : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "#64748b", fontWeight: 700 }}>{tab.label}:</span>
                <span style={{ color: val ? "#f1f5f9" : "#334155", fontWeight: 800 }}>
                  {val ?? "未選択"}
                </span>
              </button>
            );
          })}
        </div>

        {/* 保存ボタン */}
        <button
          onClick={handleApply}
          disabled={isSaving || !canApply}
          title={!canApply ? "車両番号と乗務員を選択してください" : ""}
          style={{
            padding: "11px 28px",
            borderRadius: "12px",
            border: "2px solid",
            borderColor: canApply ? "rgba(37,99,235,0.6)" : "rgba(255,255,255,0.08)",
            background: canApply ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.04)",
            color: canApply ? "#93c5fd" : "#475569",
            fontSize: "16px",
            fontWeight: 900,
            cursor: canApply ? "pointer" : "not-allowed",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {isSaving ? "⏳ 保存中..." : "🚌 保存して運転支援へ"}
        </button>
      </footer>
    </div>
  );
}

// ==================== サブコンポーネント ====================

function ListContent({
  loading, emptyText, children,
}: {
  loading: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", color: "#64748b", padding: "40px", fontSize: "15px" }}>
        ⏳ 読み込み中...
      </div>
    );
  }
  // childrenが空かどうかチェック
  const hasContent = Array.isArray(children)
    ? children.some(c => c !== null && c !== undefined && c !== false)
    : !!children;

  if (!hasContent) {
    return (
      <div style={{
        textAlign: "center", color: "#475569",
        padding: "40px 24px", fontSize: "14px", lineHeight: 1.7,
      }}>
        {emptyText}
      </div>
    );
  }
  return <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>{children}</div>;
}

function SectionLabel({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "3px 10px", borderRadius: "20px",
      background: `${color}18`, border: `1px solid ${color}40`,
      color, fontSize: "12px", fontWeight: 800,
      marginBottom: "6px", marginTop: "4px",
    }}>
      {label} <span style={{ opacity: 0.7 }}>({count}件)</span>
    </div>
  );
}

function ListRow({
  isSelected, onClick, primary, secondary, badge, color, avatar,
}: {
  isSelected: boolean;
  onClick: () => void;
  primary: string;
  secondary?: string;
  badge?: string;
  color: string;
  avatar: string;
}) {
  const isEmoji = avatar.length <= 2 && !/^[A-Za-z0-9]$/.test(avatar);
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: "10px",
        border: "1px solid",
        borderColor: isSelected ? color : "rgba(255,255,255,0.07)",
        background: isSelected ? `${color}1a` : "rgba(255,255,255,0.03)",
        color: "#f1f5f9",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        transition: "all 0.12s",
        marginBottom: "2px",
        boxShadow: isSelected ? `0 0 0 1px ${color}33` : "none",
      }}
    >
      {/* アバター */}
      <div style={{
        width: "42px",
        height: "42px",
        borderRadius: "10px",
        background: isSelected ? `${color}28` : "rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: isEmoji ? "20px" : "18px",
        fontWeight: 900,
        color: isSelected ? color : "#64748b",
        flexShrink: 0,
      }}>
        {avatar}
      </div>

      {/* テキスト */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "16px",
          fontWeight: isSelected ? 900 : 700,
          color: isSelected ? "#f1f5f9" : "#cbd5e1",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}>
          {primary}
        </div>
        {secondary && (
          <div style={{
            fontSize: "12px",
            color: "#64748b",
            marginTop: "2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {secondary}
          </div>
        )}
      </div>

      {/* バッジ */}
      {badge && (
        <div style={{
          padding: "2px 8px",
          borderRadius: "6px",
          background: isSelected ? `${color}28` : "rgba(255,255,255,0.06)",
          border: `1px solid ${isSelected ? `${color}50` : "rgba(255,255,255,0.08)"}`,
          color: isSelected ? color : "#64748b",
          fontSize: "11px",
          fontWeight: 800,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          {badge}
        </div>
      )}

      {/* 選択チェック */}
      {isSelected && (
        <div style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: "13px",
          fontWeight: 900,
          color: "#fff",
        }}>✓</div>
      )}
    </button>
  );
}
