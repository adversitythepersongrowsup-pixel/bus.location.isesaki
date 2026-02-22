import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bus, FileSpreadsheet, MessageSquare, Phone, Tablet, MapPin, CircleDot, Clock,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: routes } = trpc.gtfs.getRoutes.useQuery();
  const { data: trips } = trpc.gtfs.getTrips.useQuery();
  const { data: dias } = trpc.dia.list.useQuery();
  const { data: devices } = trpc.device.list.useQuery();
  const { data: messages } = trpc.message.list.useQuery({ limit: 10 });
  const { data: callLogs } = trpc.callLog.list.useQuery({ limit: 10 });

  const onlineDevices = devices?.filter(d => d.isOnline) ?? [];
  const unreadMessages = messages?.filter(m => !m.isRead) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-muted-foreground text-sm mt-1">
            バス運行管理システムの概要
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CircleDot className="h-3 w-3 text-green-500" />
          <span className="text-sm text-muted-foreground">
            {user?.name} でログイン中
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">路線数</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{routes?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">GTFS取込済み</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">便数</CardTitle>
            <Bus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trips?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">登録済みトリップ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ダイヤ数</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dias?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">作成済みダイヤ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">端末</CardTitle>
            <Tablet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {onlineDevices.length}
              <span className="text-sm font-normal text-muted-foreground"> / {devices?.length ?? 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">オンライン / 全端末</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              最近のメッセージ
              {unreadMessages.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadMessages.length}件未読
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {messages && messages.length > 0 ? (
              <div className="space-y-3">
                {messages.slice(0, 5).map(msg => (
                  <div key={msg.id} className="flex items-start gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${msg.isRead ? "bg-muted-foreground/30" : "bg-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{msg.senderName ?? msg.senderId}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {msg.senderType === "admin" ? "管理" : "端末"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground truncate">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">メッセージはありません</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              最近の通話
            </CardTitle>
          </CardHeader>
          <CardContent>
            {callLogs && callLogs.length > 0 ? (
              <div className="space-y-3">
                {callLogs.slice(0, 5).map(log => (
                  <div key={log.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{log.callerName ?? log.callerId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={log.status === "active" ? "default" : log.status === "ended" ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {log.status === "active" ? "通話中" : log.status === "ended" ? "終了" : log.status === "missed" ? "不在" : "呼出中"}
                      </Badge>
                      {log.duration && (
                        <span className="text-xs text-muted-foreground">
                          {Math.floor(log.duration / 60)}:{(log.duration % 60).toString().padStart(2, "0")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">通話履歴はありません</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Devices Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            端末ステータス
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices && devices.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {devices.map(device => (
                <div
                  key={device.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${device.isOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{device.deviceName ?? device.deviceId}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.deviceType === "tablet" ? "タブレット" : device.deviceType === "busloc" ? "バスロケ" : "管理"}
                      {device.vehicleId && ` / 車両: ${device.vehicleId}`}
                    </p>
                  </div>
                  <Badge variant={device.isOnline ? "default" : "outline"} className="text-xs shrink-0">
                    {device.isOnline ? "ON" : "OFF"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">登録済み端末はありません</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
