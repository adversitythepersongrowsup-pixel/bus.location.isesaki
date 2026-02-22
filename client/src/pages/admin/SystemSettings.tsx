import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Radio, MapPin, AlertTriangle, MessageSquare, Plus, Trash2, Save, RefreshCw,
} from "lucide-react";

// カテゴリ定義
const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  gps: { label: "GPS設定", icon: Radio, color: "text-green-400" },
  stop: { label: "停留所判定", icon: MapPin, color: "text-blue-400" },
  general: { label: "一般設定", icon: Settings, color: "text-slate-400" },
};

export default function SystemSettings() {
  // ==================== システム設定 ====================
  const { data: settingsList, refetch: refetchSettings } = trpc.systemSettings.list.useQuery();
  const updateSettingMut = trpc.systemSettings.update.useMutation({
    onSuccess: () => { toast.success("設定を保存しました"); refetchSettings(); },
    onError: () => toast.error("保存に失敗しました"),
  });
  const bulkUpdateMut = trpc.systemSettings.bulkUpdate.useMutation({
    onSuccess: () => { toast.success("設定を一括保存しました"); refetchSettings(); },
    onError: () => toast.error("一括保存に失敗しました"),
  });

  // ローカル編集状態
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settingsList) {
      const initial: Record<string, string> = {};
      (settingsList as any[]).forEach(s => { initial[s.key] = s.value; });
      setEditValues(initial);
      setIsDirty(false);
    }
  }, [settingsList]);

  const handleChange = (key: string, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSaveAll = async () => {
    await bulkUpdateMut.mutateAsync({ updates: editValues });
    setIsDirty(false);
  };

  const handleSaveSingle = async (key: string) => {
    await updateSettingMut.mutateAsync({ key, value: editValues[key] ?? "" });
  };

  // カテゴリ別にグループ化
  const grouped: Record<string, any[]> = {};
  (settingsList as any[] ?? []).forEach(s => {
    const cat = s.category ?? "general";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });

  // ==================== 定型返信管理 ====================
  const { data: quickReplies, refetch: refetchQR } = trpc.quickReply.list.useQuery();
  const createQRMut = trpc.quickReply.create.useMutation({
    onSuccess: () => { toast.success("定型返信を追加しました"); refetchQR(); setNewQRContent(""); },
    onError: () => toast.error("追加に失敗しました"),
  });
  const deleteQRMut = trpc.quickReply.delete.useMutation({
    onSuccess: () => { toast.success("削除しました"); refetchQR(); },
    onError: () => toast.error("削除に失敗しました"),
  });
  const updateQRMut = trpc.quickReply.update.useMutation({
    onSuccess: () => { toast.success("更新しました"); refetchQR(); setEditingQRId(null); },
    onError: () => toast.error("更新に失敗しました"),
  });

  const [newQRContent, setNewQRContent] = useState("");
  const [editingQRId, setEditingQRId] = useState<number | null>(null);
  const [editingQRContent, setEditingQRContent] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">システム設定</h1>
          <p className="text-muted-foreground text-sm mt-1">
            GPS送信間隔・停留所判定距離・早発判定秒数などの運行パラメータを管理します
          </p>
        </div>
        {isDirty && (
          <Button onClick={handleSaveAll} disabled={bulkUpdateMut.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {bulkUpdateMut.isPending ? "保存中..." : "全設定を保存"}
          </Button>
        )}
      </div>

      {/* システム設定カード（カテゴリ別） */}
      {Object.entries(grouped).map(([category, items]) => {
        const meta = CATEGORY_META[category] ?? CATEGORY_META.general;
        const Icon = meta.icon;
        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                {meta.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((setting: any) => (
                  <div key={setting.key} className="grid grid-cols-1 gap-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{setting.label}</span>
                          {setting.unit && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {setting.unit}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 font-mono">
                            {setting.key}
                          </Badge>
                        </div>
                        {setting.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {setting.valueType === "boolean" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={editValues[setting.key] === "true" ? "default" : "outline"}
                            onClick={() => handleChange(setting.key, "true")}
                            className="h-8 px-4"
                          >
                            有効
                          </Button>
                          <Button
                            size="sm"
                            variant={editValues[setting.key] === "false" ? "default" : "outline"}
                            onClick={() => handleChange(setting.key, "false")}
                            className="h-8 px-4"
                          >
                            無効
                          </Button>
                        </div>
                      ) : (
                        <Input
                          type={setting.valueType === "integer" || setting.valueType === "float" ? "number" : "text"}
                          value={editValues[setting.key] ?? setting.value}
                          onChange={e => handleChange(setting.key, e.target.value)}
                          min={setting.minValue ?? undefined}
                          max={setting.maxValue ?? undefined}
                          className="max-w-[200px] h-8 font-mono"
                        />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveSingle(setting.key)}
                        disabled={updateSettingMut.isPending}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Save className="h-3 w-3" />
                        保存
                      </Button>
                      {(setting.minValue || setting.maxValue) && (
                        <span className="text-xs text-muted-foreground">
                          {setting.minValue && `最小: ${setting.minValue}`}
                          {setting.minValue && setting.maxValue && " / "}
                          {setting.maxValue && `最大: ${setting.maxValue}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* 設定一覧が空の場合 */}
      {(!settingsList || (settingsList as any[]).length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>設定データを読み込んでいます...</p>
          </CardContent>
        </Card>
      )}

      {/* 定型返信管理 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-400" />
            定型返信管理
          </CardTitle>
          <CardDescription>
            運転支援タブレットから送信できる定型文を管理します。
            ワンタップで素早く返信できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 新規追加 */}
          <div className="flex gap-2 mb-4">
            <Input
              value={newQRContent}
              onChange={e => setNewQRContent(e.target.value)}
              placeholder="新しい定型返信を入力..."
              className="flex-1"
              onKeyDown={e => {
                if (e.key === "Enter" && newQRContent.trim()) {
                  createQRMut.mutate({ content: newQRContent.trim() });
                }
              }}
            />
            <Button
              onClick={() => { if (newQRContent.trim()) createQRMut.mutate({ content: newQRContent.trim() }); }}
              disabled={!newQRContent.trim() || createQRMut.isPending}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>

          {/* 一覧 */}
          <div className="space-y-2">
            {(quickReplies as any[] ?? []).map((qr: any) => (
              <div key={qr.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                {editingQRId === qr.id ? (
                  <>
                    <Input
                      value={editingQRContent}
                      onChange={e => setEditingQRContent(e.target.value)}
                      className="flex-1 h-8"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter") updateQRMut.mutate({ id: qr.id, content: editingQRContent });
                        if (e.key === "Escape") setEditingQRId(null);
                      }}
                    />
                    <Button size="sm" onClick={() => updateQRMut.mutate({ id: qr.id, content: editingQRContent })} className="h-8 gap-1">
                      <Save className="h-3 w-3" /> 保存
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingQRId(null)} className="h-8">
                      キャンセル
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{qr.content}</span>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { setEditingQRId(qr.id); setEditingQRContent(qr.content); }}
                      className="h-8 text-xs"
                    >
                      編集
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => deleteQRMut.mutate({ id: qr.id })}
                      className="h-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {(!quickReplies || (quickReplies as any[]).length === 0) && (
              <div className="text-center text-muted-foreground text-sm py-4">
                定型返信が設定されていません
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 早発警告設定の説明 */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            早発警告の仕組み
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>① タブレットのGPSが次の停留所から <strong className="text-foreground">「早発判定開始距離」</strong> 以内に入ると早発チェックを開始します。</p>
          <p>② 現在時刻から次の停留所の予定通過時刻まで <strong className="text-foreground">「早発判定秒数」</strong> 以下の場合、早発警告を発します。</p>
          <p>③ 警告時は画面が赤く点滅し、警告音が鳴ります。</p>
          <p>④ 停留所から <strong className="text-foreground">「停留所判定距離」</strong> 以内に入ると通過と判定し、次の停留所へ進みます。</p>
        </CardContent>
      </Card>
    </div>
  );
}
