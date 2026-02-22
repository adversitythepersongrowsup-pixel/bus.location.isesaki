import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  Plus, Download, Trash2, ChevronRight, ChevronDown,
  Bus, MapPin, CalendarDays, RefreshCw, GripVertical,
  Link2, Link2Off, Clock, ArrowRight, Filter, X, Pencil, Merge,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type DiaType = "weekday" | "holiday";

interface CreateDiaForm {
  diaName: string;
  diaType: DiaType;
  routeId: string;
  description: string;
}

// ==================== GTFS便仕分けパネル ====================
function TripAssignPanel({
  diaId,
  diaName,
  routeId,
  onClose,
}: {
  diaId: number;
  diaName: string;
  routeId: string;
  onClose: () => void;
}) {
  const [filterTime, setFilterTime] = useState("");
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterDayType, setFilterDayType] = useState<"all" | "weekday" | "holiday">("all");
  const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(new Set());

  // 全路線のstop_timesを参照（routeId指定なし）
  // departure_time → trip_id でDB側ソート済み、stop_sequence=1の始発時刻を使用
  const { data: trips, isLoading: loadingTrips } = trpc.gtfs.getTripsWithFirstStop.useQuery({});
  const { data: assignedTripIds, refetch: refetchAssigned } = trpc.gtfs.getAssignedTripIds.useQuery();
  const { data: segments, refetch: refetchSegments } = trpc.dia.getSegments.useQuery({ diaId });

  const assignMut = trpc.dia.assignTrip.useMutation({
    onSuccess: (res) => {
      toast.success(`便を紐付けました（${res.count}停留所）`);
      refetchAssigned();
      refetchSegments();
    },
    onError: (e) => toast.error(`紐付け失敗: ${e.message}`),
  });
  const removeMut = trpc.dia.removeTrip.useMutation({
    onSuccess: () => {
      toast.success("便の紐付けを解除しました");
      refetchAssigned();
      refetchSegments();
    },
    onError: (e) => toast.error(`解除失敗: ${e.message}`),
  });
  const bulkAssignMut = trpc.dia.bulkAssignTrips.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.tripCount}便を一括紐付けしました（${res.count}停留所）`);
      setSelectedTripIds(new Set());
      refetchAssigned();
      refetchSegments();
    },
    onError: (e) => toast.error(`一括紐付け失敗: ${e.message}`),
  });

  // このダイヤに紐付いているtripIdのセット
  const assignedInThisDia = useMemo(() => {
    if (!segments) return new Set<string>();
    return new Set((segments as any[]).map((s: any) => s.tripId).filter(Boolean));
  }, [segments]);

  // 方向の選択肢：stop_headsign（firstStopHeadsign）優先、NULLならtripHeadsign
  const directions = useMemo(() => {
    if (!trips) return [];
    const headsigns = Array.from(
      new Set((trips as any[]).map((t: any) =>
        t.firstStopHeadsign || t.tripHeadsign || null
      ).filter(Boolean))
    ) as string[];
    return headsigns.sort();
  }, [trips]);

  // serviceIdから平日・土日祝を判定
  // DBのservice_id実際値: "平日", "土日祝", "weekday", "holiday", "weekend" など
  const getDayType = (serviceId: string | null): "weekday" | "holiday" | "unknown" => {
    if (!serviceId) return "unknown";
    const id = serviceId.trim();
    // 平日判定：日本語「平日」または英語キーワード
    if (id === "平日" || /^(weekday|week_day|heiday|mon|tue|wed|thu|fri|平日)/i.test(id)) return "weekday";
    // 土日祝判定：日本語「土日祝」または英語キーワード
    if (id === "土日祝" || /^(holiday|weekend|week_end|sat|sun|土日祝)/i.test(id)) return "holiday";
    return "unknown";
  };
  // フィルタ適用（DB側でdeparture_time→trip_idソート済み・stop_sequence=1の始発時刻）
  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    return (trips as any[]).filter((t: any) => {
      // 始発時間フィルタ（stop_sequence=1のdeparture_time）
      if (filterTime) {
        const time = t.firstDepartureTime ?? "";
        if (!time.startsWith(filterTime)) return false;
      }
      // 方向フィルタ：stop_headsign優先、なければtripHeadsign
      if (filterDirection !== "all") {
        const headsign = t.firstStopHeadsign || t.tripHeadsign || "";
        if (headsign !== filterDirection) return false;
      }
      // 平日・土日祝フィルタ
      if (filterDayType !== "all") {
        const dayType = getDayType(t.serviceId);
        if (dayType === "unknown") return true; // 判定不能なものは表示
        if (dayType !== filterDayType) return false;
      }
      return true;
    });
  }, [trips, filterTime, filterDirection, filterDayType]);

  const assignedCount = assignedInThisDia.size;

  return (
    <div className="flex flex-col h-full">
      {/* パネルヘッダー */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            GTFS便仕分け
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ダイヤ: <span className="font-semibold text-foreground">{diaName}</span>
            {assignedCount > 0 && (
              <Badge className="ml-2 text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                {assignedCount}便紐付済
              </Badge>
            )}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* フィルタ */}
      <div className="p-3 border-b bg-muted/10 space-y-2">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground">フィルタ</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="始発時間 (例: 07)"
              value={filterTime}
              onChange={e => setFilterTime(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Select value={filterDirection} onValueChange={setFilterDirection}>
            <SelectTrigger className="h-8 text-xs w-28">
              <SelectValue placeholder="方向" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全方向</SelectItem>
              {directions.map((h: string) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDayType} onValueChange={(v) => setFilterDayType(v as "all" | "weekday" | "holiday")}>
            <SelectTrigger className="h-8 text-xs w-24">
              <SelectValue placeholder="運行区分" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全日程</SelectItem>
              <SelectItem value="weekday">平日</SelectItem>
              <SelectItem value="holiday">土日祝</SelectItem>
            </SelectContent>
          </Select>
          {(filterTime || filterDirection !== "all" || filterDayType !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => { setFilterTime(""); setFilterDirection("all"); setFilterDayType("all"); }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {loadingTrips ? "読み込み中..." : `${filteredTrips.length}件 / ${(trips ?? []).length}便`}
        </p>
        {/* 一括操作バー */}
        {filteredTrips.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                const unassigned = filteredTrips.filter((t: any) => !assignedInThisDia.has(t.tripId));
                setSelectedTripIds(new Set(unassigned.map((t: any) => t.tripId)));
              }}
            >
              全選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setSelectedTripIds(new Set())}
              disabled={selectedTripIds.size === 0}
            >
              全解除
            </Button>
            {selectedTripIds.size > 0 && (
              <Button
                size="sm"
                className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => bulkAssignMut.mutate({ diaId, tripIds: Array.from(selectedTripIds) })}
                disabled={bulkAssignMut.isPending}
              >
                <Link2 className="h-3 w-3 mr-1" />
                {selectedTripIds.size}便を一括紐付け
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 便一覧 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loadingTrips ? (
          <div className="text-center py-8 text-muted-foreground text-sm">読み込み中...</div>
        ) : filteredTrips.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm whitespace-pre-line">
            {(trips ?? []).length === 0
              ? "便データがありません。\nGTFS取込で便データを登録してください。"
              : "フィルタ条件に一致する便がありません"}
          </div>
        ) : (
          filteredTrips.map((trip: any) => {
            const isAssignedHere = assignedInThisDia.has(trip.tripId);
            const isAssignedElsewhere = !isAssignedHere && (assignedTripIds ?? []).includes(trip.tripId);
            const isSelected = selectedTripIds.has(trip.tripId);
            const toggleSelect = () => {
              if (isAssignedHere) return; // 紐付済みは選択不可
              setSelectedTripIds(prev => {
                const next = new Set(prev);
                if (next.has(trip.tripId)) next.delete(trip.tripId);
                else next.add(trip.tripId);
                return next;
              });
            };
            return (
              <div
                key={trip.tripId}
                className={`rounded-lg border p-2.5 transition-all cursor-pointer ${
                  isAssignedHere
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700"
                    : isSelected
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-600"
                    : isAssignedElsewhere
                    ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700 opacity-70"
                    : "border-border bg-background hover:bg-accent/30"
                }`}
                onClick={!isAssignedHere ? toggleSelect : undefined}
              >
                <div className="flex items-start gap-2">
                  {/* チェックボックス */}
                  {!isAssignedHere && (
                    <div className="shrink-0 pt-0.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={toggleSelect}
                        onClick={e => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {/* 始発時間（stop_sequence=1のdeparture_time）+ 方向（stop_headsign優先） */}
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-bold text-sm tabular-nums">
                        {trip.firstDepartureTime
                          ? trip.firstDepartureTime.slice(0, 5)  // HH:MM形式に整形
                          : "--:--"}
                      </span>
                      {/* 方向：stop_headsign優先、なければtripHeadsign */}
                      {(trip.firstStopHeadsign || trip.tripHeadsign) && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 max-w-[160px] truncate">
                          {trip.firstStopHeadsign || trip.tripHeadsign}
                        </Badge>
                      )}
                      {/* 路線名表示 */}
                      {trip.routeShortName && (
                        <span className="text-xs text-muted-foreground/70 truncate">
                          [{trip.routeShortName}]
                        </span>
                      )}
                    </div>
                    {/* 始発→終着 */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{trip.firstStopName ?? trip.firstStopId ?? "—"}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="truncate">{trip.lastStopName ?? trip.lastStopId ?? "—"}</span>
                      {trip.lastArrivalTime && (
                        <span className="ml-1 tabular-nums shrink-0">({trip.lastArrivalTime}着)</span>
                      )}
                    </div>
                    {/* 停留所数 + tripId + 運行区分バッジ */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{trip.stopCount ?? 0}停留所</span>
                      {trip.serviceId && (() => {
                        const dt = getDayType(trip.serviceId);
                        return dt !== "unknown" ? (
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 h-4 shrink-0 ${
                              dt === "weekday"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300"
                                : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300"
                            }`}
                          >
                            {dt === "weekday" ? "平日" : "土日祝"}
                          </Badge>
                        ) : null;
                      })()}
                      <span className="text-xs text-muted-foreground/50 truncate">{trip.tripId}</span>
                    </div>
                    {isAssignedElsewhere && (
                      <p className="text-xs text-amber-600 mt-0.5">⚠ 他のダイヤに紐付済み</p>
                    )}
                  </div>{/* flex-1 end */}

                  {/* 紐付けボタン */}
                  <div className="shrink-0">
                    {isAssignedHere ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => removeMut.mutate({ diaId, tripId: trip.tripId })}
                        disabled={removeMut.isPending}
                      >
                        <Link2Off className="h-3 w-3 mr-1" />
                        解除
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => assignMut.mutate({ diaId, tripId: trip.tripId })}
                        disabled={assignMut.isPending}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        紐付け
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ==================== メインコンポーネント ====================
export default function DiaManagement() {
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateDiaForm>({
    diaName: "", diaType: "weekday", routeId: "", description: "",
  });
  const [exportDiaId, setExportDiaId] = useState<number | null>(null);
  // ドラッグ&ドロップ用ローカル並び順（routeKey -> diaId[]）
  const [localOrders, setLocalOrders] = useState<Record<string, number[]>>({});
  // GTFS便仕分けパネル
  const [assignPanel, setAssignPanel] = useState<{ diaId: number; diaName: string; routeId: string } | null>(null);

  const { data: groupedDias, refetch } = trpc.dia.listGrouped.useQuery();
  const { data: routesList, refetch: refetchRoutes } = trpc.gtfs.getRoutes.useQuery();
  const { data: linesList, refetch: refetchLines } = trpc.line.getAll.useQuery();
  // 路線名編集・削除・統合
  const [editLineTarget, setEditLineTarget] = useState<any | null>(null);
  const [editLineForm, setEditLineForm] = useState({ lineName: "", description: "", sortOrder: 0 });
  const [mergeLineOpen, setMergeLineOpen] = useState(false);
  const [mergeLineSource, setMergeLineSource] = useState("");
  const [mergeLineTarget, setMergeLineTarget] = useState("");
  const [createLineOpen, setCreateLineOpen] = useState(false);
  const [createLineForm, setCreateLineForm] = useState({ lineId: "", lineName: "", description: "", sortOrder: 0 });
  const updateLineMut = trpc.line.update.useMutation({
    onSuccess: () => { toast.success("路線名を更新しました"); setEditLineTarget(null); refetchLines(); },
    onError: (e) => toast.error(`更新失敗: ${e.message}`),
  });
  const deleteLineMut = trpc.line.delete.useMutation({
    onSuccess: () => { toast.success("路線名を削除しました"); refetchLines(); refetch(); },
    onError: (e) => toast.error(`削除失敗: ${e.message}`),
  });
  const deleteRouteMut = trpc.line.deleteRoute.useMutation({
    onSuccess: () => { toast.success("系統を削除しました"); refetch(); refetchRoutes(); },
    onError: (e) => toast.error(`削除失敗: ${e.message}`),
  });
  const mergeLineMut = trpc.line.merge.useMutation({
    onSuccess: () => { toast.success("路線名を統合しました"); setMergeLineOpen(false); setMergeLineSource(""); setMergeLineTarget(""); refetchLines(); refetch(); },
    onError: (e) => toast.error(`統合失敗: ${e.message}`),
  });
  const createLineMut = trpc.line.create.useMutation({
    onSuccess: () => { toast.success("路線名を作成しました"); setCreateLineOpen(false); setCreateLineForm({ lineId: "", lineName: "", description: "", sortOrder: 0 }); refetchLines(); },
    onError: (e) => toast.error(`作成失敗: ${e.message}`),
  });
  const [createRouteOpen, setCreateRouteOpen] = useState(false);
  const [createRouteForm, setCreateRouteForm] = useState({ routeId: "", routeShortName: "", routeLongName: "", lineId: "" });
  const createRouteMut = trpc.line.createRoute.useMutation({
    onSuccess: () => { toast.success("系統を作成しました"); setCreateRouteOpen(false); setCreateRouteForm({ routeId: "", routeShortName: "", routeLongName: "", lineId: "" }); refetchRoutes(); refetch(); },
    onError: (e) => toast.error(`作成失敗: ${e.message}`),
  });
  const [selectedLineId, setSelectedLineId] = useState("");  // ダイヤ作成フォーム用
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());  // 路線名アコーディオン
  // 系統編集ダイアログ
  const [editRouteTarget, setEditRouteTarget] = useState<any | null>(null);
  const [editRouteForm, setEditRouteForm] = useState({
    routeShortName: "",
    routeLongName: "",
    lineId: "",
    isMerged: false,
    mergedFrom: "",  // カンマ区切りのrouteId文字列
  });
  const { data: exportData } = trpc.dia.exportCsv.useQuery(
    { diaId: exportDiaId! },
    { enabled: exportDiaId !== null }
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const createMut = trpc.dia.create.useMutation({
    onSuccess: () => {
      toast.success("ダイヤを作成しました");
      setCreateOpen(false);
      refetch();
      setForm({ diaName: "", diaType: "weekday", routeId: "", description: "" });
    },
    onError: (e) => toast.error(`作成失敗: ${e.message}`),
  });
  const deleteMut = trpc.dia.delete.useMutation({
    onSuccess: () => { toast.success("ダイヤを削除しました"); refetch(); },
    onError: (e) => toast.error(`削除失敗: ${e.message}`),
  });
  const updateMut = trpc.dia.update.useMutation({
    onSuccess: () => { toast.success("更新しました"); refetch(); },
  });
  const reorderMut = trpc.dia.reorder.useMutation({
    onError: (e) => toast.error(`並び順の保存失敗: ${e.message}`),
  });
  const updateRouteMut = trpc.line.updateRoute.useMutation({
    onSuccess: () => {
      toast.success("系統情報を更新しました");
      setEditRouteTarget(null);
      refetchRoutes();
      refetch();
    },
    onError: (e) => toast.error(`更新失敗: ${e.message}`),
  });

  const openEditRoute = (route: any) => {
    setEditRouteTarget(route);
    setEditRouteForm({
      routeShortName: route.routeShortName ?? "",
      routeLongName: route.routeLongName ?? "",
      lineId: (route as any).lineId ?? "",
      isMerged: !!(route as any).isMerged,
      mergedFrom: (() => {
        try { return JSON.parse((route as any).mergedFrom ?? "[]").join(","); }
        catch { return ""; }
      })(),
    });
  };

  const handleUpdateRoute = () => {
    if (!editRouteTarget) return;
    const mergedFromArr = editRouteForm.mergedFrom
      ? editRouteForm.mergedFrom.split(",").map(s => s.trim()).filter(Boolean)
      : null;
    updateRouteMut.mutate({
      routeId: editRouteTarget.routeId,
      routeShortName: editRouteForm.routeShortName || undefined,
      routeLongName: editRouteForm.routeLongName || undefined,
      lineId: editRouteForm.lineId || null,
      isMerged: editRouteForm.isMerged,
      mergedFrom: mergedFromArr,
    });
  };

  const handleDragEnd = (routeKey: string, diaType: "weekday" | "holiday", items: any[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(d => d.id === active.id);
    const newIdx = items.findIndex(d => d.id === over.id);
    const newOrder = arrayMove(items, oldIdx, newIdx);
    const newOrderIds = newOrder.map((d: any) => d.id);
    setLocalOrders(prev => ({ ...prev, [`${routeKey}_${diaType}`]: newOrderIds }));
    // DBに並び順を保存
    reorderMut.mutate({ orderedIds: newOrderIds });
    toast.success("並び順を保存しました");
  };

  const getOrderedDias = (routeKey: string, diaType: "weekday" | "holiday", dias: any[]) => {
    const key = `${routeKey}_${diaType}`;
    const order = localOrders[key];
    if (!order) return dias;
    const map = new Map(dias.map(d => [d.id, d]));
    return order.map(id => map.get(id)).filter(Boolean);
  };

  const handleCreate = () => {
    if (!form.diaName.trim()) { toast.error("ダイヤ名を入力してください"); return; }
    if (!form.routeId) { toast.error("路線を選択してください"); return; }
    createMut.mutate({ ...form, segments: [] });
  };

  const handleExport = async (diaId: number) => {
    setExportDiaId(diaId);
    setTimeout(() => {
      if (exportData) {
        downloadCsv(exportData, diaId);
      } else {
        toast.info("エクスポートデータを準備中です。もう一度クリックしてください。");
      }
    }, 600);
  };

  const downloadCsv = (data: { diaCsv: string; segmentsCsv: string }, diaId: number) => {
    const blob1 = new Blob([data.diaCsv], { type: "text/csv;charset=utf-8;" });
    const a1 = document.createElement("a");
    a1.href = URL.createObjectURL(blob1);
    a1.download = `dia_${diaId}.csv`;
    a1.click();
    const blob2 = new Blob([data.segmentsCsv], { type: "text/csv;charset=utf-8;" });
    const a2 = document.createElement("a");
    a2.href = URL.createObjectURL(blob2);
    a2.download = `dia_segments_${diaId}.csv`;
    a2.click();
  };

  const toggleRoute = (key: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openCreateForRoute = (routeId: string) => {
    const route = routesList?.find(r => r.routeId === routeId);
    const lineId = (route as any)?.lineId ?? "";
    setSelectedLineId(lineId);
    setForm({ diaName: "", diaType: "weekday", routeId, description: "" });
    setCreateOpen(true);
  };
  const toggleLine = (key: string) => {
    setExpandedLines(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const filteredRoutesByLine = useMemo(() => {
    if (!selectedLineId) return routesList ?? [];
    return (routesList ?? []).filter((r: any) => r.lineId === selectedLineId);
  }, [routesList, selectedLineId]);

  const routeDisplayName = (routeId: string) => {
    const r = routesList?.find(r => r.routeId === routeId);
    if (!r) return routeId;
    return r.routeShortName
      ? `${r.routeShortName} - ${r.routeLongName ?? ""}`
      : (r.routeLongName ?? routeId);
  };

  const totalDias = useMemo(
    () => groupedDias?.reduce((sum, g) => sum + g.weekday.length + g.holiday.length, 0) ?? 0,
    [groupedDias]
  );

  return (
    <div className="flex gap-4 h-full">
      {/* メインコンテンツ */}
      <div className={`flex-1 min-w-0 space-y-6 overflow-y-auto ${assignPanel ? "max-w-[calc(100%-360px)]" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">路線名・ダイヤ管理</h1>
            <p className="text-muted-foreground mt-1">路線名（路線名）→ 系統 → ダイヤ の3階層で管理します</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetch(); refetchLines(); refetchRoutes(); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> 更新
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMergeLineOpen(true)}>
              <Merge className="h-4 w-4 mr-1" /> 路線名統合
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreateLineOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> 路線名追加
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreateRouteOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> 系統追加
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setForm({ diaName: "", diaType: "weekday", routeId: "", description: "" })}>
                  <Plus className="h-4 w-4 mr-1" /> ダイヤ作成
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>新規ダイヤ作成</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {/* 路線名選択 */}
                  <div className="space-y-1.5">
                    <Label>路線名 <span className="text-red-500">*</span></Label>
                    <Select value={selectedLineId} onValueChange={v => { setSelectedLineId(v); setForm(f => ({ ...f, routeId: "" })); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="路線名を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">全路線名</SelectItem>
                        {(linesList ?? []).map((l: any) => (
                          <SelectItem key={l.lineId} value={l.lineId}>{l.lineName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(linesList ?? []).length === 0 && (
                      <p className="text-xs text-amber-600">※ 路線名が登録されていません。路線名管理から登録してください。</p>
                    )}
                  </div>
                  {/* 系統選択 */}
                  <div className="space-y-1.5">
                    <Label>系統 <span className="text-red-500">*</span></Label>
                    <Select value={form.routeId} onValueChange={v => setForm(f => ({ ...f, routeId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="系統を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredRoutesByLine.map((r: any) => (
                          <SelectItem key={r.routeId} value={r.routeId}>
                            {r.routeShortName
                              ? `${r.routeShortName} - ${r.routeLongName ?? ""}`
                              : (r.routeLongName ?? r.routeId)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {routesList?.length === 0 && (
                      <p className="text-xs text-amber-600">※ 系統が登録されていません。先にGTFS取込で系統データを登録してください。</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>ダイヤ種別 <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["weekday", "holiday"] as DiaType[]).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, diaType: type }))}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            form.diaType === type
                              ? type === "weekday"
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-red-500 bg-red-50 text-red-700"
                              : "border-border hover:border-muted-foreground/50"
                          }`}
                        >
                          {type === "weekday" ? "🗓 平日" : "🎌 土日祝"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>ダイヤ名 <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.diaName}
                      onChange={e => setForm(f => ({ ...f, diaName: e.target.value }))}
                      placeholder={
                        form.routeId
                          ? `例: ${routeDisplayName(form.routeId).split(" - ")[0]}（${form.diaType === "weekday" ? "平日" : "土日祝"}）`
                          : "例: 1系統（平日）"
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      運用例: 路線名（平日）/ 路線名（土日祝）
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>説明（任意）</Label>
                    <Textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="備考・説明"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleCreate} disabled={createMut.isPending} className="flex-1">
                      {createMut.isPending ? "作成中..." : "作成"}
                    </Button>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>キャンセル</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">路線数</p>
                  <p className="text-2xl font-bold">{groupedDias?.length ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-sm text-muted-foreground">ダイヤ総数</p>
                  <p className="text-2xl font-bold">{totalDias}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Bus className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">登録路線</p>
                  <p className="text-2xl font-bold">{routesList?.length ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 路線名→系統→ダイヤ 3階層アコーディオン */}
        <div className="space-y-3">
          {/* 路線名グループ */}
          {(linesList ?? []).map((line: any) => {
            const lineKey = `line_${line.lineId}`;
            const isLineExpanded = expandedLines.has(lineKey);
            const lineRouteGroups = (groupedDias ?? []).filter((g: any) => {
              const route = routesList?.find((r: any) => r.routeId === g.routeId);
              return (route as any)?.lineId === line.lineId;
            });
            const lineTotalDias = lineRouteGroups.reduce((s: number, g: any) => s + g.weekday.length + g.holiday.length, 0);
            return (
              <Card key={lineKey} className="overflow-hidden border-2">
                {/* 路線名ヘッダー */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors select-none bg-muted/20"
                  onClick={() => toggleLine(lineKey)}
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Bus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base truncate">{line.lineName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {lineRouteGroups.length}系統 ・ {lineTotalDias}ダイヤ
                      </span>
                      {line.description && (
                        <span className="text-xs text-muted-foreground/70 truncate">{line.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="編集"
                      onClick={() => { setEditLineTarget(line); setEditLineForm({ lineName: line.lineName, description: line.description ?? "", sortOrder: line.sortOrder ?? 0 }); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="削除"
                      onClick={() => { if (confirm(`「${line.lineName}」を削除しますか？
納付いている系統の路線名設定も解除されます。`)) deleteLineMut.mutate({ lineId: line.lineId }); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {isLineExpanded
                    ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  }
                </div>
                {/* 系統グループ */}
                {isLineExpanded && (
                  <div className="border-t divide-y">
                    {lineRouteGroups.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">この路線名に系統が登録されていません</div>
                    ) : lineRouteGroups.map((group: any) => {
                      const key = group.routeId || '__no_route__';
                      const isExpanded = expandedRoutes.has(key);
                      const displayName = group.routeShortName
                        ? `${group.routeShortName} - ${group.routeLongName ?? ""}`
                        : (group.routeLongName ?? group.routeId ?? "系統未設定");
                      const totalInGroup = group.weekday.length + group.holiday.length;
                      return (
                        <div key={key}>
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/20 transition-colors select-none"
                            onClick={() => toggleRoute(key)}
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <MapPin className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm truncate">{displayName}</p>
                                {(() => {
                                  const route = routesList?.find((r: any) => r.routeId === group.routeId);
                                  return (route as any)?.isMerged ? (
                                    <Badge className="text-xs shrink-0 bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">
                                      <Merge className="h-2.5 w-2.5 mr-1" />統合
                                    </Badge>
                                  ) : null;
                                })()}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">
                                  平日 {group.weekday.length}件 ／ 土日祝 {group.holiday.length}件
                                </span>
                                <Badge variant="secondary" className="text-xs">{totalInGroup}ダイヤ</Badge>
                              </div>
                            </div>
                            {group.routeId && (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={e => { e.stopPropagation(); openCreateForRoute(group.routeId); }}
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" /> ダイヤ追加
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-muted-foreground"
                                  onClick={e => {
                                    e.stopPropagation();
                                    const route = routesList?.find((r: any) => r.routeId === group.routeId);
                                    if (route) openEditRoute(route);
                                  }}
                                  title="系統情報を編集"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-destructive hover:bg-destructive/10"
                                  onClick={e => {
                                    e.stopPropagation();
                                    const route = routesList?.find((r: any) => r.routeId === group.routeId);
                                    const name = route?.routeShortName || route?.routeLongName || group.routeId;
                                    if (confirm(`「${name}」を削除しますか？\n納付いているダイヤ・便・停留所情報も一併削除されます。`))
                                      deleteRouteMut.mutate({ routeId: group.routeId });
                                  }}
                                  disabled={deleteRouteMut.isPending}
                                  title="系統を削除"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                            {isExpanded
                              ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                              : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            }
                          </div>
                          {isExpanded && (
                            <div className="border-t bg-muted/10">
                              {group.weekday.length > 0 && (() => {
                                const orderedWeekday = getOrderedDias(key, "weekday", group.weekday);
                                return (
                                  <div className="p-4 space-y-2">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 font-medium">
                                        🗓 平日
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">{group.weekday.length}件</span>
                                      <span className="text-xs text-muted-foreground ml-1">• ドラッグで並び替え可</span>
                                    </div>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(key, "weekday", orderedWeekday)}>
                                      <SortableContext items={orderedWeekday.map(d => d.id)} strategy={verticalListSortingStrategy}>
                                        {orderedWeekday.map(dia => (
                                          <DiaRow
                                            key={dia.id} dia={dia}
                                            isAssignPanelOpen={assignPanel?.diaId === dia.id}
                                            onDelete={() => { if (confirm(`「${dia.diaName}」を削除しますか？`)) deleteMut.mutate({ id: dia.id }); }}
                                            onToggleActive={() => updateMut.mutate({ id: dia.id, isActive: !dia.isActive })}
                                            onExport={() => handleExport(dia.id)}
                                            onAssignTrips={() => { if (assignPanel?.diaId === dia.id) { setAssignPanel(null); } else { setAssignPanel({ diaId: dia.id, diaName: dia.diaName, routeId: group.routeId ?? "" }); } }}
                                          />
                                        ))}
                                      </SortableContext>
                                    </DndContext>
                                  </div>
                                );
                              })()}
                              {group.holiday.length > 0 && (() => {
                                const orderedHoliday = getOrderedDias(key, "holiday", group.holiday);
                                return (
                                  <div className={`p-4 space-y-2 ${group.weekday.length > 0 ? "border-t" : ""}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 font-medium">
                                        🎌 土日祝
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">{group.holiday.length}件</span>
                                      <span className="text-xs text-muted-foreground ml-1">• ドラッグで並び替え可</span>
                                    </div>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(key, "holiday", orderedHoliday)}>
                                      <SortableContext items={orderedHoliday.map(d => d.id)} strategy={verticalListSortingStrategy}>
                                        {orderedHoliday.map(dia => (
                                          <DiaRow
                                            key={dia.id} dia={dia}
                                            isAssignPanelOpen={assignPanel?.diaId === dia.id}
                                            onDelete={() => { if (confirm(`「${dia.diaName}」を削除しますか？`)) deleteMut.mutate({ id: dia.id }); }}
                                            onToggleActive={() => updateMut.mutate({ id: dia.id, isActive: !dia.isActive })}
                                            onExport={() => handleExport(dia.id)}
                                            onAssignTrips={() => { if (assignPanel?.diaId === dia.id) { setAssignPanel(null); } else { setAssignPanel({ diaId: dia.id, diaName: dia.diaName, routeId: group.routeId ?? "" }); } }}
                                          />
                                        ))}
                                      </SortableContext>
                                    </DndContext>
                                  </div>
                                );
                              })()}
                              {group.weekday.length === 0 && group.holiday.length === 0 && (
                                <div className="p-6 text-center text-muted-foreground text-sm">この系統にはまだダイヤがありません</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
          {/* 路線名未設定の系統（lineIdがないダイヤ） */}
          {(groupedDias ?? []).filter((g: any) => {
            const route = routesList?.find((r: any) => r.routeId === g.routeId);
            return !(route as any)?.lineId;
          }).length > 0 && (
            <Card className="overflow-hidden border-dashed">
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/30 select-none"
                onClick={() => toggleLine('__no_line__')}>
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate text-muted-foreground">路線名未設定の系統</p>
                </div>
                {expandedLines.has('__no_line__') ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
              </div>
              {expandedLines.has('__no_line__') && (
                <div className="border-t divide-y">
                  {(groupedDias ?? []).filter((g: any) => {
                    const route = routesList?.find((r: any) => r.routeId === g.routeId);
                    return !(route as any)?.lineId;
                  }).map((group: any) => {
                    const key = group.routeId || '__no_route__';
                    const isExpanded = expandedRoutes.has(key);
                    const displayName = group.routeShortName ? `${group.routeShortName} - ${group.routeLongName ?? ""}` : (group.routeLongName ?? group.routeId ?? "系統未設定");
                    const totalInGroup = group.weekday.length + group.holiday.length;
                    return (
                      <div key={key}>
                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/20 select-none" onClick={() => toggleRoute(key)}>
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><MapPin className="h-4 w-4 text-primary" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{displayName}</p>
                            <span className="text-xs text-muted-foreground">平日 {group.weekday.length}件 ／ 土日祝 {group.holiday.length}件</span>
                            <Badge variant="secondary" className="text-xs ml-2">{totalInGroup}ダイヤ</Badge>
                          </div>
                          {group.routeId && (
                            <div className="flex gap-1 shrink-0">
                              <Button variant="outline" size="sm" className="text-xs" onClick={e => { e.stopPropagation(); openCreateForRoute(group.routeId); }}><Plus className="h-3.5 w-3.5 mr-1" /> ダイヤ追加</Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-destructive hover:bg-destructive/10"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (confirm(`「${displayName}」を削除しますか？\n納付いているダイヤ・便・停留所情報も一併削除されます。`))
                                    deleteRouteMut.mutate({ routeId: group.routeId });
                                }}
                                disabled={deleteRouteMut.isPending}
                                title="系統を削除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                          {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
          {(linesList ?? []).length === 0 && (groupedDias ?? []).length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Bus className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">ダイヤがまだ作成されていません</p>
                <p className="text-sm text-muted-foreground mt-1">まず路線名を登録し、GTFS取込で系統データを登録してからダイヤを作成してください</p>
                <Button className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> 最初のダイヤを作成</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 系統編集ダイアログ */}
      <Dialog open={!!editRouteTarget} onOpenChange={open => { if (!open) setEditRouteTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>系統情報の編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>route_id（GTFS識別子）</Label>
              <Input value={editRouteTarget?.routeId ?? ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">変更不可（GTFSインポート時に設定）</p>
            </div>
            <div className="space-y-1.5">
              <Label>route_short_name（系統番号）</Label>
              <Input
                value={editRouteForm.routeShortName}
                onChange={e => setEditRouteForm(f => ({ ...f, routeShortName: e.target.value }))}
                placeholder="例: 1, A系統"
              />
            </div>
            <div className="space-y-1.5">
              <Label>route_long_name（系統名）</Label>
              <Input
                value={editRouteForm.routeLongName}
                onChange={e => setEditRouteForm(f => ({ ...f, routeLongName: e.target.value }))}
                placeholder="例: 伊勢崎本庄線"
              />
            </div>
            <div className="space-y-1.5">
              <Label>路線名（上位階層）</Label>
              <Select value={editRouteForm.lineId} onValueChange={v => setEditRouteForm(f => ({ ...f, lineId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="路線名を選択（任意）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未分類</SelectItem>
                  {(linesList ?? []).map((l: any) => (
                    <SelectItem key={l.lineId} value={l.lineId}>{l.lineName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-1">
                  <p className="text-sm font-medium">統合系統フラグ</p>
                  <p className="text-xs text-muted-foreground">複数の系統を統合運行する場合にオン</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditRouteForm(f => ({ ...f, isMerged: !f.isMerged }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editRouteForm.isMerged ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editRouteForm.isMerged ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
              {editRouteForm.isMerged && (
                <div className="space-y-1.5">
                  <Label>統合元系統ID（カンマ区切り）</Label>
                  <Input
                    value={editRouteForm.mergedFrom}
                    onChange={e => setEditRouteForm(f => ({ ...f, mergedFrom: e.target.value }))}
                    placeholder="例: route_001,route_002"
                  />
                  <p className="text-xs text-muted-foreground">統合元のrouteIdをカンマ区切りで入力</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleUpdateRoute} disabled={updateRouteMut.isPending} className="flex-1">
                {updateRouteMut.isPending ? "更新中..." : "更新"}
              </Button>
              <Button variant="outline" onClick={() => setEditRouteTarget(null)}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 路線名編集ダイアログ */}
      <Dialog open={!!editLineTarget} onOpenChange={open => { if (!open) setEditLineTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>路線名を編集</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>路線名 <span className="text-red-500">*</span></Label>
              <Input value={editLineForm.lineName} onChange={e => setEditLineForm(f => ({ ...f, lineName: e.target.value }))} placeholder="例: 伊勢崎本庄線" />
            </div>
            <div className="space-y-1.5">
              <Label>説明（任意）</Label>
              <Input value={editLineForm.description} onChange={e => setEditLineForm(f => ({ ...f, description: e.target.value }))} placeholder="路線の説明" />
            </div>
            <div className="space-y-1.5">
              <Label>表示順</Label>
              <Input type="number" value={editLineForm.sortOrder} onChange={e => setEditLineForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => updateLineMut.mutate({ id: editLineTarget?.id, ...editLineForm })} disabled={updateLineMut.isPending}>
                {updateLineMut.isPending ? "更新中..." : "更新"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setEditLineTarget(null)}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* 路線名作成ダイアログ */}
      <Dialog open={createLineOpen} onOpenChange={setCreateLineOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>路線名を追加</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>路線名ID <span className="text-red-500">*</span></Label>
              <Input value={createLineForm.lineId} onChange={e => setCreateLineForm(f => ({ ...f, lineId: e.target.value }))} placeholder="例: LINE001" />
              <p className="text-xs text-muted-foreground">英数字・ハイフン・アンダースコアが使えます</p>
            </div>
            <div className="space-y-1.5">
              <Label>路線名 <span className="text-red-500">*</span></Label>
              <Input value={createLineForm.lineName} onChange={e => setCreateLineForm(f => ({ ...f, lineName: e.target.value }))} placeholder="例: 伊勢崎本庄線" />
            </div>
            <div className="space-y-1.5">
              <Label>説明（任意）</Label>
              <Input value={createLineForm.description} onChange={e => setCreateLineForm(f => ({ ...f, description: e.target.value }))} placeholder="路線の説明" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => {
                if (!createLineForm.lineId.trim()) { toast.error("路線名IDを入力してください"); return; }
                if (!createLineForm.lineName.trim()) { toast.error("路線名を入力してください"); return; }
                createLineMut.mutate(createLineForm);
              }} disabled={createLineMut.isPending}>
                {createLineMut.isPending ? "作成中..." : "作成"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setCreateLineOpen(false)}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* 路線名統合ダイアログ */}
      <Dialog open={mergeLineOpen} onOpenChange={setMergeLineOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>路線名を統合</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">統合元の路線名に納付いている系統・ダイヤを統合先に移動し、統合元の路線名は削除されます。</p>
            <div className="space-y-1.5">
              <Label>統合元（削除される路線名）</Label>
              <Select value={mergeLineSource} onValueChange={setMergeLineSource}>
                <SelectTrigger><SelectValue placeholder="統合元を選択" /></SelectTrigger>
                <SelectContent>
                  {(linesList ?? []).filter((l: any) => l.lineId !== mergeLineTarget).map((l: any) => (
                    <SelectItem key={l.lineId} value={l.lineId}>{l.lineName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>統合先（残る路線名）</Label>
              <Select value={mergeLineTarget} onValueChange={setMergeLineTarget}>
                <SelectTrigger><SelectValue placeholder="統合先を選択" /></SelectTrigger>
                <SelectContent>
                  {(linesList ?? []).filter((l: any) => l.lineId !== mergeLineSource).map((l: any) => (
                    <SelectItem key={l.lineId} value={l.lineId}>{l.lineName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" variant="destructive" onClick={() => {
                if (!mergeLineSource || !mergeLineTarget) { toast.error("統合元と統合先を選択してください"); return; }
                if (!confirm(`「${(linesList ?? []).find((l: any) => l.lineId === mergeLineSource)?.lineName}」を「${(linesList ?? []).find((l: any) => l.lineId === mergeLineTarget)?.lineName}」に統合しますか？\n統合元の路線名は削除されます。`)) return;
                mergeLineMut.mutate({ sourceLineId: mergeLineSource, targetLineId: mergeLineTarget });
              }} disabled={mergeLineMut.isPending}>
                {mergeLineMut.isPending ? "統合中..." : "統合実行"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setMergeLineOpen(false)}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* 系統追加ダイアログ */}
      <Dialog open={createRouteOpen} onOpenChange={setCreateRouteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>系統を追加</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>route_id（識別子・必須）</Label>
              <Input
                value={createRouteForm.routeId}
                onChange={e => setCreateRouteForm(f => ({ ...f, routeId: e.target.value }))}
                placeholder="例: route_001"
              />
            </div>
            <div className="space-y-1.5">
              <Label>route_short_name（系統番号）</Label>
              <Input
                value={createRouteForm.routeShortName}
                onChange={e => setCreateRouteForm(f => ({ ...f, routeShortName: e.target.value }))}
                placeholder="例: 1, A系統"
              />
            </div>
            <div className="space-y-1.5">
              <Label>route_long_name（系統名）</Label>
              <Input
                value={createRouteForm.routeLongName}
                onChange={e => setCreateRouteForm(f => ({ ...f, routeLongName: e.target.value }))}
                placeholder="例: 伊勢崎本庄線"
              />
            </div>
            <div className="space-y-1.5">
              <Label>路線名（上位階層）</Label>
              <Select value={createRouteForm.lineId} onValueChange={v => setCreateRouteForm(f => ({ ...f, lineId: v }))}>
                <SelectTrigger><SelectValue placeholder="路線名を選択（任意）" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未分類</SelectItem>
                  {(linesList ?? []).map((l: any) => (
                    <SelectItem key={l.lineId} value={l.lineId}>{l.lineName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={() => {
                  if (!createRouteForm.routeId.trim()) { toast.error("route_idを入力してください"); return; }
                  const isDuplicate = (routesList ?? []).some((r: any) => r.routeId === createRouteForm.routeId.trim());
                  if (isDuplicate) { toast.error(`route_id 「${createRouteForm.routeId.trim()}」は既に存在します。別のidを指定してください`); return; }
                  createRouteMut.mutate({
                    routeId: createRouteForm.routeId.trim(),
                    routeShortName: createRouteForm.routeShortName || undefined,
                    routeLongName: createRouteForm.routeLongName || undefined,
                    lineId: (createRouteForm.lineId && createRouteForm.lineId !== "__none__") ? createRouteForm.lineId : null,
                  });
                }}
                disabled={createRouteMut.isPending}
              >
                {createRouteMut.isPending ? "作成中..." : "作成"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setCreateRouteOpen(false)}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* GTFS便仕分けサイドパネル */}
      {assignPanel && (
        <div className="w-[360px] shrink-0 border rounded-xl bg-background shadow-lg overflow-hidden flex flex-col"
          style={{ height: "calc(100vh - 120px)", position: "sticky", top: 0 }}>
          <TripAssignPanel
            diaId={assignPanel.diaId}
            diaName={assignPanel.diaName}
            routeId={assignPanel.routeId}
            onClose={() => setAssignPanel(null)}
          />
        </div>
      )}
    </div>
  );
}

// ==================== ダイヤ行コンポーネント ====================
function DiaRow({
  dia,
  isAssignPanelOpen,
  onDelete,
  onToggleActive,
  onExport,
  onAssignTrips,
}: {
  dia: {
    id: number;
    diaName: string;
    diaType: string;
    isActive: boolean;
    description?: string | null;
  };
  isAssignPanelOpen: boolean;
  onDelete: () => void;
  onToggleActive: () => void;
  onExport: () => void;
  onAssignTrips: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dia.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  // このダイヤの紐付け済み便数を取得
  const { data: segments } = trpc.dia.getSegments.useQuery({ diaId: dia.id });
  const assignedTripCount = useMemo(() => {
    if (!segments) return 0;
    return new Set((segments as any[]).map((s: any) => s.tripId).filter(Boolean)).size;
  }, [segments]);

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`flex items-center gap-2 p-3 rounded-lg border bg-background transition-all ${
        dia.isActive ? "opacity-100" : "opacity-50"
      } ${isAssignPanelOpen ? "border-primary ring-1 ring-primary/30 bg-primary/5" : ""}`}>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors shrink-0"
          style={{ touchAction: "none" }}
          title="ドラッグして並び替え"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{dia.diaName}</p>
            {!dia.isActive && (
              <Badge variant="outline" className="text-xs shrink-0">無効</Badge>
            )}
            {assignedTripCount > 0 && (
              <Badge className="text-xs shrink-0 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                {assignedTripCount}便
              </Badge>
            )}
          </div>
          {dia.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{dia.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* GTFS便仕分けボタン */}
          <Button
            variant={isAssignPanelOpen ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onAssignTrips}
            title="GTFS便を仕分け"
          >
            <Link2 className="h-3 w-3 mr-1" />
            便仕分け
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={onToggleActive}
          >
            {dia.isActive ? "無効化" : "有効化"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={onExport}
            title="CSVエクスポート"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="削除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
