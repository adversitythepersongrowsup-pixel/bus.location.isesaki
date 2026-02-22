import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, RefreshCw, Bus, MapPin, Link2, Link2Off, ChevronDown, ChevronRight, Merge } from "lucide-react";

// ==================== 路線名管理ページ ====================
export default function LineManagement() {
  const { data: linesList, refetch: refetchLines } = trpc.line.getAll.useQuery();
  const { data: routesList, refetch: refetchRoutes } = trpc.gtfs.getRoutes.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  const [form, setForm] = useState({ lineId: "", lineName: "", description: "", sortOrder: 0 });
  const [editForm, setEditForm] = useState({ lineName: "", description: "", sortOrder: 0 });

  // 系統紐付けダイアログ
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLineId, setAssignLineId] = useState<string>("");
  const [assignRouteId, setAssignRouteId] = useState("");

  const createMut = trpc.line.create.useMutation({
    onSuccess: () => {
      toast.success("路線名を作成しました");
      setCreateOpen(false);
      setForm({ lineId: "", lineName: "", description: "", sortOrder: 0 });
      refetchLines();
    },
    onError: (e) => toast.error(`作成失敗: ${e.message}`),
  });

  const updateMut = trpc.line.update.useMutation({
    onSuccess: () => {
      toast.success("路線名を更新しました");
      setEditTarget(null);
      refetchLines();
    },
    onError: (e) => toast.error(`更新失敗: ${e.message}`),
  });

  const deleteMut = trpc.line.delete.useMutation({
    onSuccess: () => {
      toast.success("路線名を削除しました");
      refetchLines();
    },
    onError: (e) => toast.error(`削除失敗: ${e.message}`),
  });

  const setRouteLineMut = trpc.line.setRouteLineId.useMutation({
    onSuccess: () => {
      toast.success("系統の紐付けを更新しました");
      setAssignOpen(false);
      setAssignRouteId("");
      refetchRoutes();
    },
    onError: (e) => toast.error(`紐付け失敗: ${e.message}`),
  });

  const toggleLine = (id: number) => {
    setExpandedLines(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 系統編集ダイアログ
  const [editRouteTarget, setEditRouteTarget] = useState<any | null>(null);
  const [editRouteForm, setEditRouteForm] = useState({
    routeShortName: "",
    routeLongName: "",
    lineId: "",
    isMerged: false,
    mergedFrom: "",
  });

  const updateRouteMut = trpc.line.updateRoute.useMutation({
    onSuccess: () => {
      toast.success("系統情報を更新しました");
      setEditRouteTarget(null);
      refetchRoutes();
    },
    onError: (e) => toast.error(`更新失敗: ${e.message}`),
  });

  const openEditRoute = (r: any) => {
    setEditRouteTarget(r);
    setEditRouteForm({
      routeShortName: r.routeShortName ?? "",
      routeLongName: r.routeLongName ?? "",
      lineId: r.lineId ?? "",
      isMerged: !!r.isMerged,
      mergedFrom: (() => {
        try { return JSON.parse(r.mergedFrom ?? "[]").join(","); }
        catch { return ""; }
      })(),
    });
  };

  const handleUpdateRoute = () => {
    if (!editRouteTarget) return;
    const mergedFromArr = editRouteForm.mergedFrom
      ? editRouteForm.mergedFrom.split(",").map((s: string) => s.trim()).filter(Boolean)
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

  // 各路線名に紐付いている系統一覧
  const routesByLine = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of routesList ?? []) {
      const lineId = (r as any).lineId ?? "__none__";
      if (!map.has(lineId)) map.set(lineId, []);
      map.get(lineId)!.push(r);
    }
    return map;
  }, [routesList]);

  // 未紐付けの系統一覧
  const unassignedRoutes = useMemo(() => {
    return (routesList ?? []).filter((r: any) => !r.lineId);
  }, [routesList]);

  const routeDisplayName = (r: any) =>
    r.routeShortName ? `${r.routeShortName} - ${r.routeLongName ?? ""}` : (r.routeLongName ?? r.routeId);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">路線名管理</h1>
          <p className="text-muted-foreground mt-1">路線名を登録し、系統（GTFS路線）を紐付けます。路線名 → 系統 → ダイヤ の階層で管理されます。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchLines(); refetchRoutes(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> 更新
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm({ lineId: "", lineName: "", description: "", sortOrder: 0 })}>
                <Plus className="h-4 w-4 mr-1" /> 路線名を追加
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>路線名を追加</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>路線ID <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="例: LINE001"
                    value={form.lineId}
                    onChange={e => setForm(f => ({ ...f, lineId: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">英数字・ハイフン・アンダースコアが使えます</p>
                </div>
                <div className="space-y-1.5">
                  <Label>路線名 <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="例: 伊勢崎本庄線"
                    value={form.lineName}
                    onChange={e => setForm(f => ({ ...f, lineName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>説明（任意）</Label>
                  <Textarea
                    placeholder="路線の説明を入力..."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>表示順</Label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (!form.lineId.trim()) { toast.error("路線IDを入力してください"); return; }
                      if (!form.lineName.trim()) { toast.error("路線名を入力してください"); return; }
                      createMut.mutate(form);
                    }}
                    disabled={createMut.isPending}
                  >
                    作成
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>キャンセル</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Bus className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">路線名数</p>
              <p className="text-2xl font-bold">{linesList?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">系統数</p>
              <p className="text-2xl font-bold">{routesList?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Link2Off className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm text-muted-foreground">未紐付け系統</p>
              <p className="text-2xl font-bold">{unassignedRoutes.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 路線名一覧 */}
      <div className="space-y-3">
        {(linesList ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bus className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">路線名がまだ登録されていません</p>
              <p className="text-sm text-muted-foreground mt-1">「路線名を追加」ボタンから最初の路線名を登録してください</p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> 路線名を追加
              </Button>
            </CardContent>
          </Card>
        ) : (
          (linesList ?? []).map((line: any) => {
            const isExpanded = expandedLines.has(line.id);
            const assignedRoutes = routesByLine.get(line.lineId) ?? [];
            return (
              <Card key={line.id} className="overflow-hidden border-2">
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors select-none bg-muted/10"
                  onClick={() => toggleLine(line.id)}>
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Bus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-base truncate">{line.lineName}</p>
                      <Badge variant="outline" className="text-xs shrink-0">{line.lineId}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{assignedRoutes.length}系統紐付き</span>
                      {line.description && <span className="text-xs text-muted-foreground/60 truncate">{line.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* 系統紐付けボタン */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setAssignLineId(line.lineId);
                        setAssignRouteId("");
                        setAssignOpen(true);
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1" /> 系統紐付け
                    </Button>
                    {/* 編集ボタン */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setEditTarget(line);
                        setEditForm({ lineName: line.lineName, description: line.description ?? "", sortOrder: line.sortOrder ?? 0 });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {/* 削除ボタン */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`「${line.lineName}」を削除しますか？\n紐付いている系統の路線名設定も解除されます。`))
                          deleteMut.mutate({ lineId: line.lineId });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {isExpanded
                    ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  }
                </div>
                {/* 紐付き系統一覧 */}
                {isExpanded && (
                  <div className="border-t bg-muted/5 p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">紐付き系統（{assignedRoutes.length}件）</p>
                    {assignedRoutes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">この路線名に系統が紐付いていません。「系統紐付け」ボタンから追加してください。</p>
                    ) : (
                      <div className="space-y-1.5">
                        {assignedRoutes.map((r: any) => (
                          <div key={r.routeId} className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm flex-1 truncate">{routeDisplayName(r)}</span>
                            {r.isMerged && (
                              <Badge className="text-xs shrink-0 bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">
                                <Merge className="h-2.5 w-2.5 mr-1" />統合
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs shrink-0">{r.routeId}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                              title="系統情報を編集"
                              onClick={() => openEditRoute(r)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive/60 hover:text-destructive shrink-0"
                              title="紐付けを解除"
                              onClick={() => setRouteLineMut.mutate({ routeId: r.routeId, lineId: null })}
                            >
                              <Link2Off className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* 未紐付け系統 */}
      {unassignedRoutes.length > 0 && (
        <Card className="border-dashed border-amber-300">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2Off className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">路線名未設定の系統（{unassignedRoutes.length}件）</p>
            </div>
            <div className="space-y-1.5">
              {unassignedRoutes.map((r: any) => (
                <div key={r.routeId} className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{routeDisplayName(r)}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{r.routeId}</Badge>
                  <Select onValueChange={v => setRouteLineMut.mutate({ routeId: r.routeId, lineId: v })}>
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue placeholder="路線名を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {(linesList ?? []).map((l: any) => (
                        <SelectItem key={l.lineId} value={l.lineId}>{l.lineName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 系統紐付けダイアログ */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>系統を紐付ける</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              路線名「<span className="font-semibold text-foreground">{(linesList ?? []).find((l: any) => l.lineId === assignLineId)?.lineName ?? assignLineId}</span>」に系統を紐付けます。
            </p>
            <div className="space-y-1.5">
              <Label>系統を選択 <span className="text-red-500">*</span></Label>
              <Select value={assignRouteId} onValueChange={setAssignRouteId}>
                <SelectTrigger>
                  <SelectValue placeholder="系統を選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {(routesList ?? []).map((r: any) => (
                    <SelectItem key={r.routeId} value={r.routeId}>
                      <span className="flex items-center gap-2">
                        {routeDisplayName(r)}
                        {(r as any).lineId && (r as any).lineId !== assignLineId && (
                          <Badge variant="outline" className="text-xs ml-1">
                            {(linesList ?? []).find((l: any) => l.lineId === (r as any).lineId)?.lineName ?? (r as any).lineId}に紐付き
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={() => {
                  if (!assignRouteId) { toast.error("系統を選択してください"); return; }
                  setRouteLineMut.mutate({ routeId: assignRouteId, lineId: assignLineId });
                }}
                disabled={setRouteLineMut.isPending}
              >
                紐付ける
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setAssignOpen(false)}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <Select value={editRouteForm.lineId || "__none__"} onValueChange={v => setEditRouteForm(f => ({ ...f, lineId: v === "__none__" ? "" : v }))}>
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

      {/* 編集ダイアログ */}
      <Dialog open={!!editTarget} onOpenChange={v => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>路線名を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>路線名 <span className="text-red-500">*</span></Label>
              <Input
                value={editForm.lineName}
                onChange={e => setEditForm(f => ({ ...f, lineName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>説明（任意）</Label>
              <Textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>表示順</Label>
              <Input
                type="number"
                value={editForm.sortOrder}
                onChange={e => setEditForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={() => {
                  if (!editForm.lineName.trim()) { toast.error("路線名を入力してください"); return; }
                  updateMut.mutate({ id: editTarget.id, ...editForm });
                }}
                disabled={updateMut.isPending}
              >
                更新
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
