import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Tablet, Monitor, MapPin, Wifi, WifiOff } from "lucide-react";

export default function AdminDevices() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<"tablet" | "busloc" | "admin">("tablet");
  const [vehicleId, setVehicleId] = useState("");

  const { data: devices, refetch } = trpc.device.list.useQuery();
  const upsertMut = trpc.device.upsert.useMutation();
  const deleteMut = trpc.device.delete.useMutation();

  const handleAdd = async () => {
    if (!deviceId.trim()) { toast.error("端末IDを入力してください"); return; }
    try {
      await upsertMut.mutateAsync({
        deviceId: deviceId.trim(),
        deviceName: deviceName.trim() || undefined,
        deviceType,
        vehicleId: vehicleId.trim() || undefined,
      });
      toast.success("端末を登録しました");
      setIsAddOpen(false);
      setDeviceId("");
      setDeviceName("");
      setVehicleId("");
      refetch();
    } catch (e: any) {
      toast.error("登録に失敗しました");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この端末を削除しますか？")) return;
    try {
      await deleteMut.mutateAsync({ deviceId: id });
      toast.success("端末を削除しました");
      refetch();
    } catch (e: any) {
      toast.error("削除に失敗しました");
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "tablet": return <Tablet className="h-5 w-5" />;
      case "busloc": return <MapPin className="h-5 w-5" />;
      case "admin": return <Monitor className="h-5 w-5" />;
      default: return <Tablet className="h-5 w-5" />;
    }
  };

  const getDeviceTypeName = (type: string) => {
    switch (type) {
      case "tablet": return "タブレット";
      case "busloc": return "バスロケ";
      case "admin": return "管理PC";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">端末管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            タブレット・バスロケ端末の登録・管理
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> 端末追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>端末追加</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>端末ID</Label>
                <Input placeholder="例: tablet-001" value={deviceId} onChange={e => setDeviceId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>端末名</Label>
                <Input placeholder="例: 1号車タブレット" value={deviceName} onChange={e => setDeviceName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>端末種別</Label>
                <Select value={deviceType} onValueChange={(v: "tablet" | "busloc" | "admin") => setDeviceType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tablet">タブレット</SelectItem>
                    <SelectItem value="busloc">バスロケ</SelectItem>
                    <SelectItem value="admin">管理PC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>車両ID（任意）</Label>
                <Input placeholder="例: BUS-101" value={vehicleId} onChange={e => setVehicleId(e.target.value)} />
              </div>
              <Button onClick={handleAdd} disabled={upsertMut.isPending} className="w-full">
                登録
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Device Grid */}
      {devices && devices.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map(device => (
            <Card key={device.id} className="relative">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      device.isOnline ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                    }`}>
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{device.deviceName ?? device.deviceId}</p>
                      <p className="text-xs text-muted-foreground font-mono">{device.deviceId}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(device.deviceId)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">種別</span>
                    <Badge variant="outline" className="text-xs">{getDeviceTypeName(device.deviceType)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">状態</span>
                    <div className="flex items-center gap-1.5">
                      {device.isOnline ? (
                        <><Wifi className="h-3 w-3 text-green-500" /><span className="text-green-600 text-xs">オンライン</span></>
                      ) : (
                        <><WifiOff className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground text-xs">オフライン</span></>
                      )}
                    </div>
                  </div>
                  {device.vehicleId && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">車両</span>
                      <span className="text-xs">{device.vehicleId}</span>
                    </div>
                  )}
                  {device.lastSyncAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">最終同期</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(device.lastSyncAt).toLocaleString("ja-JP")}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <Tablet className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">端末が登録されていません</p>
              <p className="text-sm text-muted-foreground mt-1">「端末追加」ボタンから端末を登録してください</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
