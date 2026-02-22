import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, User, Pencil, Trash, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortKey = "driverName" | "driverCode";
type SortDir = "asc" | "desc";

export default function DriverManagement() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverCode, setDriverCode] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("driverCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const { data: driversList, refetch } = trpc.driver.list.useQuery();
  const createMut = trpc.driver.create.useMutation();
  const updateMut = trpc.driver.update.useMutation();
  const deleteMut = trpc.driver.delete.useMutation();
  const deleteAllMut = trpc.driver.deleteAll.useMutation();

  const resetForm = () => { setDriverName(""); setDriverCode(""); setEditId(null); };

  const handleAdd = async () => {
    if (!driverName.trim()) { toast.error("乗務員名を入力してください"); return; }
    try {
      await createMut.mutateAsync({
        driverName: driverName.trim(),
        driverCode: driverCode.trim() || undefined,
      });
      toast.success("乗務員を登録しました");
      setIsAddOpen(false); resetForm(); refetch();
    } catch (e: any) {
      toast.error(e?.message?.includes("Duplicate") ? "この乗務員コードは既に登録されています" : "登録に失敗しました");
    }
  };

  const handleUpdate = async () => {
    if (editId === null) return;
    try {
      await updateMut.mutateAsync({
        id: editId,
        driverName: driverName.trim() || undefined,
        driverCode: driverCode.trim() || undefined,
      });
      toast.success("乗務員情報を更新しました");
      setEditId(null); resetForm(); refetch();
    } catch { toast.error("更新に失敗しました"); }
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    try { await updateMut.mutateAsync({ id, isActive: !current }); refetch(); }
    catch { toast.error("更新に失敗しました"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この乗務員を削除しますか？")) return;
    try { await deleteMut.mutateAsync({ id }); toast.success("乗務員を削除しました"); refetch(); }
    catch { toast.error("削除に失敗しました"); }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`全${driversList?.length ?? 0}件の乗務員を削除しますか？\nこの操作は元に戻せません。`)) return;
    try { await deleteAllMut.mutateAsync(); toast.success("全乗務員を削除しました"); refetch(); }
    catch { toast.error("全削除に失敗しました"); }
  };

  const startEdit = (d: any) => {
    setEditId(d.id);
    setDriverName(d.driverName);
    setDriverCode(d.driverCode ?? "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">乗務員管理</h1>
          <p className="text-muted-foreground text-sm mt-1">乗務員名の登録・管理</p>
        </div>
        <div className="flex gap-2">
          {driversList && driversList.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={deleteAllMut.isPending}>
              <Trash className="h-4 w-4 mr-1" /> 全削除
            </Button>
          )}
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> 乗務員追加</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>乗務員追加</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>乗務員名 <span className="text-destructive">*</span></Label>
                  <Input placeholder="例: 山田 太郎" value={driverName} onChange={e => setDriverName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>乗務員コード（任意）</Label>
                  <Input placeholder="例: D001" value={driverCode} onChange={e => setDriverCode(e.target.value)} />
                </div>
                <Button onClick={handleAdd} disabled={createMut.isPending} className="w-full">登録</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {driversList && driversList.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort("driverName")}>
                  <div className="flex items-center">乗務員名<SortIcon k="driverName" /></div>
                </TableHead>
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort("driverCode")}>
                  <div className="flex items-center">乗務員コード<SortIcon k="driverCode" /></div>
                </TableHead>
                <TableHead className="font-semibold">状態</TableHead>
                <TableHead className="font-semibold text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...driversList].sort((a, b) => {
                const av = (a[sortKey] ?? "").toString();
                const bv = (b[sortKey] ?? "").toString();
                const cmp = av.localeCompare(bv, "ja", { numeric: true });
                return sortDir === "asc" ? cmp : -cmp;
              }).map(d => (
                <TableRow key={d.id} className={!d.isActive ? "opacity-60" : ""}>
                  {editId === d.id ? (
                    <TableCell colSpan={4}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input className="w-40" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="乗務員名" />
                        <Input className="w-32" value={driverCode} onChange={e => setDriverCode(e.target.value)} placeholder="乗務員コード" />
                        <Button size="sm" onClick={handleUpdate} disabled={updateMut.isPending}>保存</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditId(null); resetForm(); }}>キャンセル</Button>
                      </div>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell className="font-bold text-base">{d.driverName}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {d.driverCode ?? <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={d.isActive} onCheckedChange={() => handleToggleActive(d.id, d.isActive)} />
                          <Badge variant={d.isActive ? "default" : "secondary"} className="text-xs">
                            {d.isActive ? "有効" : "無効"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(d)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border p-12 flex flex-col items-center gap-4 text-center">
          <User className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <p className="font-medium">乗務員が登録されていません</p>
            <p className="text-sm text-muted-foreground mt-1">「乗務員追加」ボタンから乗務員を登録してください</p>
          </div>
        </div>
      )}
    </div>
  );
}
