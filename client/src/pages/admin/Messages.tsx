import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MessageSquare, User, Tablet, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { useMessageSSE } from "@/hooks/useSSE";

type MessageItem = {
  id: number;
  senderId: string;
  senderType: string;
  senderName: string | null;
  receiverId: string | null;
  receiverType: string | null;
  content: string;
  isRead: boolean;
  createdAt: Date | string;
};

export default function AdminMessages() {
  const { user, isAuthenticated } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [isSSEConnected, setIsSSEConnected] = useState(false);
  const [localMessages, setLocalMessages] = useState<MessageItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: messages, refetch } = trpc.message.list.useQuery(
    { limit: 100 },
    {
      // Fallback polling every 30s (SSE handles real-time)
      refetchInterval: 30000,
    }
  );
  const { data: devices } = trpc.device.list.useQuery();
  const { data: deviceStates } = trpc.deviceState.listAll.useQuery(undefined, { refetchInterval: 5000 });
  const { data: dias } = trpc.dia.list.useQuery();
  const sendMut = trpc.message.send.useMutation();
  const markReadMut = trpc.message.markRead.useMutation();

  // Initialize local messages from query
  useEffect(() => {
    if (messages) {
      setLocalMessages(messages as MessageItem[]);
    }
  }, [messages]);

  // SSE real-time message handler
  const handleNewMessage = useCallback((msg: MessageItem) => {
    setLocalMessages(prev => {
      // Avoid duplicates
      if (prev.some(m => m.id === msg.id)) return prev;
      const updated = [...prev, msg];
      // Sort by createdAt ascending
      updated.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return updated;
    });
    // Show toast notification for tablet messages
    if (msg.senderType === "tablet") {
      toast.info(`📱 ${msg.senderName ?? msg.senderId}: ${msg.content}`, {
        duration: 4000,
      });
    }
    // Invalidate query cache to keep in sync
    utils.message.list.invalidate();
  }, [utils]);

  useMessageSSE({
    onNewMessage: handleNewMessage,
    onConnected: () => setIsSSEConnected(true),
    onError: () => setIsSSEConnected(false),
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages]);

  // Mark unread messages as read
  useEffect(() => {
    if (localMessages.length > 0) {
      const unreadIds = localMessages
        .filter(m => !m.isRead && m.senderType === "tablet")
        .map(m => m.id);
      if (unreadIds.length > 0) {
        markReadMut.mutate({ ids: unreadIds });
      }
    }
  }, [localMessages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    if (!isAuthenticated) { toast.error("ログインが必要です"); return; }

    try {
      await sendMut.mutateAsync({
        senderId: user?.openId ?? "admin",
        senderType: "admin",
        senderName: user?.name ?? "管理者",
        receiverId: selectedDevice === "all" ? undefined : selectedDevice,
        receiverType: selectedDevice === "all" ? undefined : "tablet",
        content: newMessage.trim(),
      });
      setNewMessage("");
    } catch {
      toast.error("送信に失敗しました");
    }
  };

  const filteredMessages = localMessages.filter(m => {
    if (selectedDevice === "all") return true;
    return m.senderId === selectedDevice || m.receiverId === selectedDevice;
  });

  // Count unread messages per device
  const unreadByDevice = (deviceId: string) =>
    localMessages.filter(m => m.senderId === deviceId && !m.isRead && m.senderType === "tablet").length;

  const totalUnread = localMessages.filter(m => !m.isRead && m.senderType === "tablet").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">メッセージ管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            タブレット端末とのメッセージ送受信
          </p>
        </div>
        {/* SSE Connection Status */}
        <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
          isSSEConnected
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          {isSSEConnected ? (
            <><Wifi className="h-3.5 w-3.5" /> リアルタイム接続中</>
          ) : (
            <><WifiOff className="h-3.5 w-3.5" /> 接続待機中...</>
          )}
        </div>
      </div>

      {!isAuthenticated && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          ログインしていないため、メッセージの送信ができません（受信は可能）
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Device List */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">端末一覧</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <button
              onClick={() => setSelectedDevice("all")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedDevice === "all" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                全体
                {totalUnread > 0 && (
                  <Badge variant="destructive" className="ml-auto text-xs h-5 px-1.5">
                    {totalUnread}
                  </Badge>
                )}
              </div>
            </button>
            {devices?.filter(d => d.deviceType === "tablet").map(device => {
              const unread = unreadByDevice(device.deviceId);
              return (
                <button
                  key={device.deviceId}
                  onClick={() => setSelectedDevice(device.deviceId)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedDevice === device.deviceId ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Tablet className="h-4 w-4" />
                    <span className="truncate">{(() => {
                      const state = deviceStates?.find((s: any) => s.deviceId === device.deviceId);
                      const parts: string[] = [];
                      if (state?.diaId) {
                        const dia = dias?.find((d: any) => d.id === state.diaId);
                        parts.push(`ダイヤ:${dia?.diaName ?? String(state.diaId)}`);
                      }
                      if (state?.vehicleNo) parts.push(`車両:${state.vehicleNo}`);
                      if (state?.driverName) parts.push(`乗務員:${state.driverName}`);
                      return parts.length > 0 ? parts.join(" - ") : (device.deviceName ?? device.deviceId);
                    })()}</span>
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                      {unread > 0 && (
                        <Badge variant="destructive" className="text-xs h-5 px-1.5">{unread}</Badge>
                      )}
                      <div className={`w-2 h-2 rounded-full ${device.isOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                    </div>
                  </div>
                </button>
              );
            })}
            {(!devices || devices.filter(d => d.deviceType === "tablet").length === 0) && (
              <p className="text-xs text-muted-foreground px-3 py-2">タブレット端末なし</p>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: "400px" }}>
          <CardHeader className="pb-3 border-b shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {selectedDevice === "all" ? "全体メッセージ" : `端末: ${selectedDevice}`}
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {filteredMessages.length} 件
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-3">
                {filteredMessages.length > 0 ? (
                  filteredMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderType === "admin" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 ${
                        msg.senderType === "admin"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {msg.senderType === "admin" ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Tablet className="h-3 w-3" />
                          )}
                          <span className="text-xs font-medium">{msg.senderName ?? msg.senderId}</span>
                          {!msg.isRead && msg.senderType === "tablet" && (
                            <Badge variant="destructive" className="text-xs h-4 px-1 ml-1">新着</Badge>
                          )}
                        </div>
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.senderType === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {new Date(msg.createdAt).toLocaleString("ja-JP")}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    メッセージはありません
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3 shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder={isAuthenticated ? "メッセージを入力... (Enter で送信)" : "ログインが必要です"}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={!isAuthenticated}
                />
                <Button
                  onClick={handleSend}
                  disabled={!isAuthenticated || !newMessage.trim() || sendMut.isPending}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {selectedDevice !== "all" && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  送信先: {(() => {
                    const device = devices?.find(d => d.deviceId === selectedDevice);
                    const state = deviceStates?.find((s: any) => s.deviceId === selectedDevice);
                    const parts: string[] = [];
                    if (state?.diaId) {
                      const dia = dias?.find((d: any) => d.id === state.diaId);
                      parts.push(`ダイヤ:${dia?.diaName ?? String(state.diaId)}`);
                    }
                    if (state?.vehicleNo) parts.push(`車両:${state.vehicleNo}`);
                    if (state?.driverName) parts.push(`乗務員:${state.driverName}`);
                    return parts.length > 0 ? parts.join(" - ") : (device?.deviceName ?? selectedDevice);
                  })()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
