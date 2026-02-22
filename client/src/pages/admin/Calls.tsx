import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useState } from "react";
import { Phone, PhoneOff, PhoneCall, Mic, MicOff, AlertCircle } from "lucide-react";

export default function AdminCalls() {
  const { user, isAuthenticated } = useAuth();
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const { data: devices } = trpc.device.list.useQuery();
  const { data: deviceStates } = trpc.deviceState.listAll.useQuery(undefined, { refetchInterval: 5000 });
  const { data: dias } = trpc.dia.list.useQuery();
  const { data: callLogs, refetch } = trpc.callLog.list.useQuery(
    { limit: 50 },
    { refetchInterval: 3000 }
  );

  const startCallMut = trpc.callLog.start.useMutation();
  const updateStatusMut = trpc.callLog.updateStatus.useMutation();

  const handleStartCall = async () => {
    if (!selectedDevice) { toast.error("通話先の端末を選択してください"); return; }
    if (!isAuthenticated) { toast.error("ログインが必要です"); return; }

    try {
      const result = await startCallMut.mutateAsync({
        callerId: user?.openId ?? "admin",
        callerType: "admin",
        callerName: user?.name ?? "管理者",
        receiverId: selectedDevice,
        receiverType: "tablet",
      });
      setActiveCallId(result.callId);
      // Simulate call becoming active
      setTimeout(async () => {
        if (result.callId) {
          await updateStatusMut.mutateAsync({ id: result.callId, status: "active" });
          refetch();
        }
      }, 2000);
      toast.success("通話を開始しました");
      refetch();
    } catch (e: any) {
      toast.error("通話の開始に失敗しました");
    }
  };

  const handleEndCall = async () => {
    if (!activeCallId) return;
    try {
      await updateStatusMut.mutateAsync({
        id: activeCallId,
        status: "ended",
        duration: 0,
      });
      setActiveCallId(null);
      setIsMuted(false);
      toast.success("通話を終了しました");
      refetch();
    } catch (e: any) {
      toast.error("通話の終了に失敗しました");
    }
  };

  const activeCall = callLogs?.find(c => c.id === activeCallId && (c.status === "ringing" || c.status === "active"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">通話管理</h1>
        <p className="text-muted-foreground text-sm mt-1">
          タブレット端末との通話開始・管理
        </p>
      </div>

      {!isAuthenticated && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          ログインしていないため、通話機能を使用できません
        </div>
      )}

      {/* Call Control */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />
            通話操作
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeCall ? (
            /* Active Call UI */
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
                <Phone className="h-10 w-10 text-green-500" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {activeCall.status === "ringing" ? "呼び出し中..." : "通話中"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeCall.receiverId ?? "不明"}
                </p>
              </div>
              <div className="flex gap-4">
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  size="lg"
                  onClick={() => setIsMuted(!isMuted)}
                  className="rounded-full w-14 h-14"
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleEndCall}
                  className="rounded-full w-14 h-14"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ) : (
            /* Start Call UI */
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="text-sm font-medium">通話先端末</label>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="端末を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices?.filter(d => d.deviceType === "tablet").map(device => {
                      const state = deviceStates?.find((s: any) => s.deviceId === device.deviceId);
                      const parts: string[] = [];
                      if (state?.diaId) {
                        const dia = dias?.find((d: any) => d.id === state.diaId);
                        parts.push(`ダイヤ:${dia?.diaName ?? String(state.diaId)}`);
                      }
                      if (state?.vehicleNo) parts.push(`車両:${state.vehicleNo}`);
                      if (state?.driverName) parts.push(`乗務員:${state.driverName}`);
                      const label = parts.length > 0 ? parts.join(" - ") : (device.deviceName ?? device.deviceId);
                      return (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${device.isOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                            {label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleStartCall}
                disabled={!selectedDevice || !isAuthenticated}
                className="gap-2"
              >
                <Phone className="h-4 w-4" />
                通話開始
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">通話履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {callLogs && callLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>発信者</TableHead>
                  <TableHead>相手</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>通話時間</TableHead>
                  <TableHead>日時</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {log.callerType === "admin" ? "管理" : "端末"}
                        </Badge>
                        <span className="text-sm">{log.callerName ?? log.callerId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{(() => {
                      const state = deviceStates?.find((s: any) => s.deviceId === log.receiverId);
                      if (!state) return log.receiverId ?? "-";
                      const parts: string[] = [];
                      if (state?.diaId) {
                        const dia = dias?.find((d: any) => d.id === state.diaId);
                        parts.push(`ダイヤ:${dia?.diaName ?? String(state.diaId)}`);
                      }
                      if (state?.vehicleNo) parts.push(`車両:${state.vehicleNo}`);
                      if (state?.driverName) parts.push(`乗務員:${state.driverName}`);
                      return parts.length > 0 ? parts.join(" - ") : (log.receiverId ?? "-");
                    })()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === "active" ? "default" :
                          log.status === "ended" ? "secondary" :
                          log.status === "missed" ? "destructive" : "outline"
                        }
                        className="text-xs"
                      >
                        {log.status === "active" ? "通話中" :
                         log.status === "ended" ? "終了" :
                         log.status === "missed" ? "不在" : "呼出中"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.duration ? `${Math.floor(log.duration / 60)}:${(log.duration % 60).toString().padStart(2, "0")}` : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("ja-JP")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">通話履歴はありません</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
