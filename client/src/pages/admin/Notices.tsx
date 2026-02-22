import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Bell, RefreshCw, AlertTriangle, Info, Ban, Navigation } from "lucide-react";

type NoticeType = "info" | "delay" | "cancel" | "detour" | "other";

const NOTICE_TYPES: { value: NoticeType; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { value: "info",   label: "お知らせ", icon: <Info className="h-4 w-4" />,          color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  { value: "delay",  label: "遅延",     icon: <AlertTriangle className="h-4 w-4" />, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  { value: "cancel", label: "運休",     icon: <Ban className="h-4 w-4" />,           color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  { value: "detour", label: "迂回",     icon: <Navigation className="h-4 w-4" />,    color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  { value: "other",  label: "その他",   icon: <Bell className="h-4 w-4" />,          color: "text-slate-600",  bg: "bg-slate-50 border-slate-200" },
];

function getTypeInfo(type: string) {
  return NOTICE_TYPES.find(t => t.value === type) ?? NOTICE_TYPES[4];
}

interface NoticeForm {
  routeId: string;
  stopId: string;
  noticeType: NoticeType;
  title: string;
  content: string;
  isActive: boolean;
  endsAt: string;
}

const EMPTY_FORM: NoticeForm = {
  routeId: "", stopId: "", noticeType: "info",
  title: "", content: "", isActive: true, endsAt: "",
};

export default function Notices() {
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<NoticeForm>(EMPTY_FORM);

  const { data: notices, refetch } = trpc.notice.list.useQuery();
  const { data: routes } = trpc.publicBusloc.getRoutes.useQuery();
  const { data: stops } = trpc.publicBusloc.getStops.useQuery(
    { routeId: form.routeId },
    { enabled: !!form.routeId }
  );

  const createMut = trpc.notice.create.useMutation({
    onSuccess: () => { toast.success("お知らせを作成しました"); setIsOpen(false); setForm(EMPTY_FORM); refetch(); },
    onError: (e) => toast.error(`作成失敗: ${e.message}`),
  });
  const updateMut = trpc.notice.update.useMutation({
    onSuccess: () => { toast.success("更新しました"); setIsOpen(false); setEditId(null); setForm(EMPTY_FORM); refetch(); },
    onError: (e) => toast.error(`更新失敗: ${e.message}`),
  });
  const deleteMut = trpc.notice.delete.useMutation({
    onSuccess: () => { toast.success("削除しました"); refetch(); },
    onError: (e) => toast.error(`削除失敗: ${e.message}`),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error("タイトルを入力してください"); return; }
    if (!form.content.trim()) { toast.error("内容を入力してください"); return; }
    const payload = {
      routeId: form.routeId || undefined,
      stopId: form.stopId || undefined,
      noticeType: form.noticeType,
      title: form.title.trim(),
      content: form.content.trim(),
      isActive: form.isActive,
      endsAt: form.endsAt || undefined,
    };
    if (editId !== null) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const startEdit = (n: any) => {
    setEditId(n.id);
    setForm({
      routeId: n.routeId ?? "",
      stopId: n.stopId ?? "",
      noticeType: n.noticeType as NoticeType,
      title: n.title,
      content: n.content,
      isActive: n.isActive,
      endsAt: n.endsAt ? new Date(n.endsAt).toISOString().slice(0, 16) : "",
    });
    setIsOpen(true);
  };

  const handleToggleActive = (n: any) => {
    updateMut.mutate({ id: n.id, isActive: !n.isActive });
  };

  const activeCount = (notices ?? []).filter((n: any) => n.isActive).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">運行情報・お知らせ管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            バスロケ画面に表示するお知らせを管理します（運休・遅延・迂回など）
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> 更新
          </Button>
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) { setEditId(null); setForm(EMPTY_FORM); }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> お知らせ作成</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editId !== null ? "お知らせ編集" : "お知らせ作成"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* 種別 */}
                <div className="space-y-1.5">
                  <Label>種別 <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-3 gap-2">
                    {NOTICE_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, noticeType: t.value }))}
                        className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
                          form.noticeType === t.value
                            ? `border-current ${t.bg} ${t.color}`
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* タイトル */}
                <div className="space-y-1.5">
                  <Label>タイトル <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="例: ○○線 遅延のお知らせ"
                  />
                </div>

                {/* 内容 */}
                <div className="space-y-1.5">
                  <Label>内容 <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="例: 悪天候の影響により、○○線は現在約15分の遅れが発生しています。ご迷惑をおかけして申し訳ございません。"
                    rows={3}
                  />
                </div>

                {/* 路線・停留所（任意） */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>対象路線（任意）</Label>
                    <Select
                      value={form.routeId || "__all__"}
                      onValueChange={v => setForm(f => ({ ...f, routeId: v === "__all__" ? "" : v, stopId: "" }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="全路線" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">全路線</SelectItem>
                        {(routes ?? []).map((r: any) => (
                          <SelectItem key={r.routeId} value={r.routeId}>{r.routeShortName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>対象停留所（任意）</Label>
                    <Select
                      value={form.stopId || "__all__"}
                      onValueChange={v => setForm(f => ({ ...f, stopId: v === "__all__" ? "" : v }))}
                      disabled={!form.routeId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="全停留所" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">全停留所</SelectItem>
                        {(stops ?? []).map((s: any) => (
                          <SelectItem key={s.stopId} value={s.stopId}>{s.stopName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 掲示終了日時 */}
                <div className="space-y-1.5">
                  <Label>掲示終了日時（任意）</Label>
                  <Input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">空白の場合は手動で無効化するまで表示されます</p>
                </div>

                {/* 有効/無効 */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">今すぐ表示</p>
                    <p className="text-xs text-muted-foreground">バスロケ画面に即時表示します</p>
                  </div>
                  <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="flex-1">
                    {editId !== null ? "更新" : "作成"}
                  </Button>
                  <Button variant="outline" onClick={() => { setIsOpen(false); setEditId(null); setForm(EMPTY_FORM); }}>
                    キャンセル
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">総お知らせ数</p>
                <p className="text-2xl font-bold">{(notices ?? []).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">表示中</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">遅延・運休</p>
                <p className="text-2xl font-bold text-orange-600">
                  {(notices ?? []).filter((n: any) => n.isActive && (n.noticeType === "delay" || n.noticeType === "cancel")).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* お知らせ一覧 */}
      {(notices ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">お知らせがありません</p>
            <p className="text-sm text-muted-foreground mt-1">「お知らせ作成」ボタンから運行情報を登録してください</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(notices ?? []).map((n: any) => {
            const typeInfo = getTypeInfo(n.noticeType);
            const isExpired = n.endsAt && new Date(n.endsAt) < new Date();
            return (
              <Card key={n.id} className={`${!n.isActive || isExpired ? "opacity-60" : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-2 rounded-lg border ${typeInfo.bg} ${typeInfo.color} shrink-0`}>
                      {typeInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              className={`text-xs font-bold border ${typeInfo.bg} ${typeInfo.color} hover:${typeInfo.bg}`}
                            >
                              {typeInfo.label}
                            </Badge>
                            <span className="font-semibold text-sm">{n.title}</span>
                            {(!n.isActive || isExpired) && (
                              <Badge variant="outline" className="text-xs">
                                {isExpired ? "期限切れ" : "非表示"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.content}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            {n.routeId && (
                              <span>路線: {(routes ?? []).find((r: any) => r.routeId === n.routeId)?.routeShortName ?? n.routeId}</span>
                            )}
                            {n.stopId && <span>停留所: {n.stopId}</span>}
                            {n.endsAt && (
                              <span>終了: {new Date(n.endsAt).toLocaleString("ja-JP")}</span>
                            )}
                            <span>作成: {new Date(n.createdAt).toLocaleString("ja-JP")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch
                            checked={n.isActive && !isExpired}
                            onCheckedChange={() => handleToggleActive(n)}
                            disabled={isExpired}
                          />
                          <Button variant="ghost" size="sm" onClick={() => startEdit(n)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { if (confirm("このお知らせを削除しますか？")) deleteMut.mutate({ id: n.id }); }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
