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
import { Plus, Trash2, Bus, Pencil, Trash, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortKey = "vehicleNumber" | "vehicleName";
type SortDir = "asc" | "desc";

export default function VehicleManagement() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("vehicleNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const { data: vehicles, refetch } = trpc.vehicle.list.useQuery();
  const createMut = trpc.vehicle.create.useMutation();
  const updateMut = trpc.vehicle.update.useMutation();
  const deleteMut = trpc.vehicle.delete.useMutation();
  const deleteAllMut = trpc.vehicle.deleteAll.useMutation();

  const resetForm = () => { setVehicleNumber(""); setVehicleName(""); setCapacity(""); setEditId(null); };

  const handleAdd = async () => {
    if (!vehicleNumber.trim()) { toast.error("車両番号を入力してください"); return; }
    try {
      await createMut.mutateAsync({
        vehicleNumber: vehicleNumber.trim(),
        vehicleName: vehicleName.trim() || undefined,
        capacity: capacity ? parseInt(capacity) : undefined,
      });
      toast.success("車両を登録しました");
      setIsAddOpen(false); resetForm(); refetch();
    } catch (e: any) {
      toast.error(e?.message?.includes("Duplicate") ? "この車両番号は既に登録されています" : "登録に失敗しました");
    }
  };

  const handleUpdate = async () => {
    if (editId === null) return;
    try {
      await updateMut.mutateAsync({
        id: editId,
        vehicleNumber: vehicleNumber.trim() || undefined,
        vehicleName: vehicleName.trim() || undefined,
        capacity: capacity ? parseInt(capacity) : undefined,
      });
      toast.success("車両情報を更新しました");
      setEditId(null); resetForm(); refetch();
    } catch { toast.error("更新に失敗しました"); }
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    try { await updateMut.mutateAsync({ id, isActive: !current }); refetch(); }
    catch { toast.error("更新に失敗しました"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この車両を削除しますか？")) return;
    try { await deleteMut.mutateAsync({ id }); toast.success("車両を削除しました"); refetch(); }
    catch { toast.error("削除に失敗しました"); }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`全${vehicles?.length ?? 0}件の車両を削除しますか？\nこの操作は元に戻せません。`)) return;
    try { await deleteAllMut.mutateAsync(); toast.success("全車両を削除しました"); refetch(); }
    catch { toast.error("全削除に失敗しました"); }
  };

  const startEdit = (v: any) => {
    setEditId(v.id);
    setVehicleNumber(v.vehicleNumber);
    setVehicleName(v.vehicleName ?? "");
    setCapacity(v.capacity?.toString() ?? "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">車両管理</h1>
          <p className="text-muted-foreground text-sm mt-1">車両番号の登録・管理</p>
        </div>
        <div className="flex gap-2">
          {vehicles && vehicles.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={deleteAllMut.isPending}>
              <Trash className="h-4 w-4 mr-1" /> 全削除
            </Button>
          )}
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> 車両追加</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>車両追加</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>車両番号 <span className="text-destructive">*</span></Label>
                  <Input placeholder="例: 1001" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>車両名（任意）</Label>
                  <Input placeholder="例: 大型バス1号" value={vehicleName} onChange={e => setVehicleName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>定員（任意）</Label>
                  <Input type="number" placeholder="例: 50" value={capacity} onChange={e => setCapacity(e.target.value)} />
                </div>
                <Button onClick={handleAdd} disabled={createMut.isPending} className="w-full">登録</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {vehicles && vehicles.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort("vehicleNumber")}>
                  <div className="flex items-center">車両番号<SortIcon k="vehicleNumber" /></div>
                </TableHead>
                <TableHead className="font-semibold cursor-pointer select-none" onClick={() => handleSort("vehicleName")}>
                  <div className="flex items-center">車両名<SortIcon k="vehicleName" /></div>
                </TableHead>
                <TableHead className="font-semibold">定員</TableHead>
                <TableHead className="font-semibold">状態</TableHead>
                <TableHead className="font-semibold text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...vehicles].sort((a, b) => {
                const av = (a[sortKey] ?? "").toString();
                const bv = (b[sortKey] ?? "").toString();
                const cmp = av.localeCompare(bv, "ja", { numeric: true });
                return sortDir === "asc" ? cmp : -cmp;
              }).map(v => (
                <TableRow key={v.id} className={!v.isActive ? "opacity-60" : ""}>
                  {editId === v.id ? (
                    <TableCell colSpan={5}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input className="w-32" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="車両番号" />
                        <Input className="w-40" value={vehicleName} onChange={e => setVehicleName(e.target.value)} placeholder="車両名" />
                        <Input className="w-24" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="定員" />
                        <Button size="sm" onClick={handleUpdate} disabled={updateMut.isPending}>保存</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditId(null); resetForm(); }}>キャンセル</Button>
                      </div>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell className="font-bold text-base">{v.vehicleNumber}</TableCell>
                      <TableCell className="text-base">{v.vehicleName ?? <span className="text-muted-foreground text-sm">-</span>}</TableCell>
                      <TableCell className="text-base">{v.capacity != null ? `${v.capacity}人` : <span className="text-muted-foreground text-sm">-</span>}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={v.isActive} onCheckedChange={() => handleToggleActive(v.id, v.isActive)} />
                          <Badge variant={v.isActive ? "default" : "secondary"} className="text-xs">
                            {v.isActive ? "有効" : "無効"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(v)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)}>
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
          <Bus className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <p className="font-medium">車両が登録されていません</p>
            <p className="text-sm text-muted-foreground mt-1">「車両追加」ボタンから車両を登録してください</p>
          </div>
        </div>
      )}
    </div>
  );
}
