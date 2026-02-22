import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  FileSpreadsheet,
  MessageSquare,
  Phone,
  Settings,
  MapPin,
  Bus,
  Tablet,
  CircleDot,
  CarFront,
  Users,
  Bell,
  GripVertical,
  SlidersHorizontal,
  Pencil,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Check,
  X,
  Link,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ==================== 型定義 ====================
type MenuItem = {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  isCustom?: boolean;
};

// ==================== デフォルトメニュー定義 ====================
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, FileSpreadsheet, Bus, MessageSquare, Phone,
  CarFront, Users, Tablet, MapPin, Bell, Settings, SlidersHorizontal, Link,
};

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "ダッシュボード", path: "/", visible: true },
  { id: "gtfs", icon: FileSpreadsheet, label: "GTFS取込", path: "/gtfs", visible: true },
  { id: "dia", icon: Bus, label: "路線名・ダイヤ管理", path: "/dia", visible: true },
  { id: "messages", icon: MessageSquare, label: "メッセージ", path: "/messages", visible: true },
  { id: "calls", icon: Phone, label: "通話管理", path: "/calls", visible: true },
  { id: "vehicles", icon: CarFront, label: "車両管理", path: "/vehicles", visible: true },
  { id: "drivers", icon: Users, label: "乗務員管理", path: "/drivers", visible: true },
  { id: "devices", icon: Tablet, label: "端末管理", path: "/devices", visible: true },
  { id: "busloc", icon: MapPin, label: "バスロケ", path: "/busloc", visible: true },
  { id: "notices", icon: Bell, label: "運行情報・お知らせ", path: "/notices", visible: true },
  { id: "setup", icon: Settings, label: "初期設定", path: "/setup", visible: true },
  { id: "system-settings", icon: SlidersHorizontal, label: "システム設定", path: "/system-settings", visible: true },
];

const MENU_STORAGE_KEY = "menu-config-v2";
const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function loadMenuConfig(): MenuItem[] {
  try {
    const saved = localStorage.getItem(MENU_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Array<{
        id: string; label: string; path: string; visible: boolean; iconName?: string; isCustom?: boolean;
      }>;
      // デフォルト項目を更新し、カスタム項目を追加
      const defaultMap = new Map(DEFAULT_MENU_ITEMS.map(m => [m.id, m]));
      const result: MenuItem[] = [];
      for (const item of parsed) {
        if (defaultMap.has(item.id)) {
          const def = defaultMap.get(item.id)!;
          result.push({ ...def, label: item.label, visible: item.visible });
        } else if (item.isCustom) {
          const icon = item.iconName ? (ICON_MAP[item.iconName] ?? Link) : Link;
          result.push({ id: item.id, label: item.label, path: item.path, visible: item.visible, icon, isCustom: true });
        }
      }
      // 新しいデフォルト項目を末尾に追加
      const savedIds = new Set(parsed.map(p => p.id));
      for (const def of DEFAULT_MENU_ITEMS) {
        if (!savedIds.has(def.id)) result.push(def);
      }
      return result;
    }
  } catch {}
  return DEFAULT_MENU_ITEMS;
}

function saveMenuConfig(items: MenuItem[]) {
  const data = items.map(m => ({
    id: m.id, label: m.label, path: m.path, visible: m.visible, isCustom: m.isCustom ?? false,
    iconName: Object.entries(ICON_MAP).find(([, v]) => v === m.icon)?.[0],
  }));
  localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(data));
}

// ==================== 運行情報パネル ====================
const NOTICE_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  cancel: { label: "運休", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  delay:  { label: "遅延", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  detour: { label: "迂回", color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  info:   { label: "お知らせ", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  other:  { label: "その他", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

function SidebarNoticePanel({ uiSettingsMap }: { uiSettingsMap?: Record<string, string> }) {
  const { data: noticesRaw, isLoading } = trpc.notice.list.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // 表示するnoticeTypeをuiSettingsから取得（デフォルト: cancel,delay,detour,info,other 全て）
  const enabledTypes = useMemo(() => {
    const raw = uiSettingsMap?.["sidebar.notice.types"];
    if (!raw) return ["cancel", "delay", "detour", "info", "other"];
    try { return JSON.parse(raw) as string[]; } catch { return ["cancel", "delay", "detour", "info", "other"]; }
  }, [uiSettingsMap]);

  const showPanel = uiSettingsMap?.["sidebar.notice.enabled"] !== "false";
  if (!showPanel) return null;

  const filtered = (noticesRaw ?? []).filter((n) => enabledTypes.includes(n.noticeType ?? ""));

  if (isLoading) {
    return (
      <div className="mx-2 mb-2 px-3 py-2 rounded-lg bg-sidebar-accent/30 border border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/40 animate-pulse">読み込み中...</div>
      </div>
    );
  }

  if (filtered.length === 0) return null;

  return (
    <div className="mx-2 mb-2 rounded-lg border border-sidebar-border bg-sidebar-accent/20 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-sidebar-border flex items-center gap-1.5">
        <Bell className="h-3 w-3 text-sidebar-foreground/60" />
        <span className="text-xs font-semibold text-sidebar-foreground/70">運行情報</span>
        <span className="ml-auto text-xs font-bold text-orange-400">{filtered.length}</span>
      </div>
      <div className="divide-y divide-sidebar-border">
        {filtered.slice(0, 3).map((n: any) => {
          const typeInfo = NOTICE_TYPE_LABELS[n.noticeType] ?? NOTICE_TYPE_LABELS.other;
          return (
            <div key={n.id} className="px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span style={{ color: typeInfo.color, background: typeInfo.bg, border: `1px solid ${typeInfo.color}40` }}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                  {typeInfo.label}
                </span>
                <span className="text-xs text-sidebar-foreground truncate font-medium">{n.title}</span>
              </div>
              {n.content && (
                <p className="text-[11px] text-sidebar-foreground/50 truncate">{n.content}</p>
              )}
            </div>
          );
        })}
        {filtered.length > 3 && (
          <div className="px-3 py-1.5 text-[11px] text-sidebar-foreground/40 text-center">
            他 {filtered.length - 3} 件
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== メインコンポーネント ====================
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bus className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-center">バス運行管理システム</h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              管理画面にアクセスするにはログインが必要です
            </p>
          </div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full shadow-lg hover:shadow-xl transition-all">
            ログイン
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

// ==================== ソート可能なメニューアイテム ====================
function SortableMenuItem({
  item, isActive, editMode, onNavigate, onToggleVisible, onEditLabel, onDelete,
}: {
  item: MenuItem;
  isActive: boolean;
  editMode: boolean;
  onNavigate: () => void;
  onToggleVisible: () => void;
  onEditLabel: (newLabel: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.label) onEditLabel(trimmed);
    setEditing(false);
  };

  useEffect(() => {
    if (editing) {
      setDraft(item.label);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing, item.label]);

  if (editMode) {
    return (
      <SidebarMenuItem>
        <div ref={setNodeRef} style={style} className={`flex items-center w-full gap-1 py-0.5 rounded-md px-1 ${!item.visible ? "opacity-40" : ""}`}>
          {/* ドラッグハンドル */}
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-sidebar-foreground/40 hover:text-sidebar-foreground/70 shrink-0 p-1" style={{ touchAction: "none" }} title="ドラッグして並び替え">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          {/* 表示/非表示トグル */}
          <button onClick={onToggleVisible} className={`shrink-0 p-1 rounded transition-colors ${item.visible ? "text-green-400 hover:text-green-300" : "text-sidebar-foreground/30 hover:text-sidebar-foreground/60"}`} title={item.visible ? "非表示にする" : "表示する"}>
            {item.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          {/* ラベル編集 */}
          {editing ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
                className="flex-1 min-w-0 text-xs bg-sidebar-accent border border-sidebar-border rounded px-2 py-1 text-sidebar-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <button onClick={commitEdit} className="text-green-400 hover:text-green-300 shrink-0 p-0.5"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={() => setEditing(false)} className="text-sidebar-foreground/40 hover:text-sidebar-foreground/70 shrink-0 p-0.5"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <item.icon className="h-3.5 w-3.5 text-sidebar-foreground/60 shrink-0" />
              <span className="text-xs text-sidebar-foreground truncate flex-1">{item.label}</span>
              <button onClick={() => setEditing(true)} className="text-sidebar-foreground/30 hover:text-sidebar-foreground/70 shrink-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" title="文言を編集">
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          {/* カスタム項目は削除可能 */}
          {item.isCustom && !editing && (
            <button onClick={onDelete} className="text-destructive/50 hover:text-destructive shrink-0 p-0.5" title="削除">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </SidebarMenuItem>
    );
  }

  // 通常表示（非表示項目はレンダリングしない）
  if (!item.visible) return null;

  return (
    <SidebarMenuItem>
      <div ref={setNodeRef} style={style} className="flex items-center w-full">
        <SidebarMenuButton isActive={isActive} onClick={onNavigate} tooltip={item.label} className="h-10 transition-all font-normal flex-1">
          <item.icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70"}`} />
          <span className="text-sm">{item.label}</span>
        </SidebarMenuButton>
      </div>
    </SidebarMenuItem>
  );
}

// ==================== メニュー項目追加ダイアログ ====================
function AddMenuItemForm({ onAdd, onCancel }: { onAdd: (item: Omit<MenuItem, "icon"> & { iconName: string }) => void; onCancel: () => void }) {
  const [label, setLabel] = useState("");
  const [path, setPath] = useState("/");
  const [iconName, setIconName] = useState("Link");

  const handleSubmit = () => {
    if (!label.trim() || !path.trim()) return;
    onAdd({ id: `custom_${Date.now()}`, label: label.trim(), path: path.trim(), visible: true, isCustom: true, iconName });
  };

  return (
    <div className="mx-2 my-1 p-2 rounded-md bg-sidebar-accent/50 border border-sidebar-border space-y-1.5">
      <p className="text-xs font-medium text-sidebar-foreground/80">メニュー項目を追加</p>
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="表示名"
        className="w-full text-xs bg-sidebar-accent border border-sidebar-border rounded px-2 py-1 text-sidebar-foreground outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        value={path}
        onChange={e => setPath(e.target.value)}
        placeholder="パス（例: /custom）"
        className="w-full text-xs bg-sidebar-accent border border-sidebar-border rounded px-2 py-1 text-sidebar-foreground outline-none focus:ring-1 focus:ring-primary"
      />
      <select
        value={iconName}
        onChange={e => setIconName(e.target.value)}
        className="w-full text-xs bg-sidebar-accent border border-sidebar-border rounded px-2 py-1 text-sidebar-foreground outline-none focus:ring-1 focus:ring-primary"
      >
        {Object.keys(ICON_MAP).map(name => <option key={name} value={name}>{name}</option>)}
      </select>
      <div className="flex gap-1">
        <button onClick={handleSubmit} disabled={!label.trim()} className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1 disabled:opacity-40">追加</button>
        <button onClick={onCancel} className="flex-1 text-xs bg-sidebar-accent border border-sidebar-border rounded px-2 py-1 text-sidebar-foreground/70">キャンセル</button>
      </div>
    </div>
  );
}

// ==================== DashboardLayoutContent ====================
type DashboardLayoutContentProps = { children: React.ReactNode; setSidebarWidth: (width: number) => void };

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // メニュー設定
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => loadMenuConfig());
  const [editMode, setEditMode] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const visibleItems = menuItems.filter(m => m.visible);
  const activeMenuItem = visibleItems.find(item =>
    location === item.path || (item.path !== "/" && location.startsWith(item.path))
  );

  // DB設定を読み込んでメニューに反映（管理者のみ）
  const { data: uiSettingsMap } = trpc.uiSettings.getMap.useQuery(undefined, {
    staleTime: 30000,
    enabled: !!user,
  });
  const bulkUpdateMutation = trpc.uiSettings.bulkUpdate.useMutation();

  useEffect(() => {
    if (!uiSettingsMap) return;
    setMenuItems(prev => prev.map(item => {
      const labelKey = `menu.${item.id}.label`;
      const visibleKey = `menu.${item.id}.visible`;
      const newLabel = uiSettingsMap[labelKey] ?? item.label;
      const newVisible = uiSettingsMap[visibleKey] !== undefined ? uiSettingsMap[visibleKey] === "true" : item.visible;
      return { ...item, label: newLabel, visible: newVisible };
    }));
  }, [uiSettingsMap]);

  const saveMenuItems = useCallback((items: MenuItem[]) => {
    saveMenuConfig(items);
    // DB保存（管理者のみ）
    if (user?.role === "admin") {
      const updates: Array<{ key: string; value: string }> = [];
      for (const item of items) {
        updates.push({ key: `menu.${item.id}.label`, value: item.label });
        updates.push({ key: `menu.${item.id}.visible`, value: String(item.visible) });
      }
      bulkUpdateMutation.mutate(updates, {
        onSuccess: () => toast.success("メニュー設定を保存しました"),
        onError: () => toast.error("保存に失敗しました"),
      });
    }
  }, [user, bulkUpdateMutation]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleMenuDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setMenuItems(prev => {
      const oldIdx = prev.findIndex(m => m.id === active.id);
      const newIdx = prev.findIndex(m => m.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  const handleToggleVisible = useCallback((id: string) => {
    setMenuItems(prev => prev.map(m => m.id === id ? { ...m, visible: !m.visible } : m));
  }, []);

  const handleEditLabel = useCallback((id: string, newLabel: string) => {
    setMenuItems(prev => prev.map(m => m.id === id ? { ...m, label: newLabel } : m));
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    setMenuItems(prev => prev.filter(m => m.id !== id));
  }, []);

  const handleAddItem = useCallback((item: Omit<MenuItem, "icon"> & { iconName: string }) => {
    const icon = ICON_MAP[item.iconName] ?? Link;
    setMenuItems(prev => [...prev, { ...item, icon }]);
    setShowAddForm(false);
  }, []);

  const handleSaveEditMode = useCallback(() => {
    saveMenuItems(menuItems);
    setEditMode(false);
    setShowAddForm(false);
  }, [menuItems, saveMenuItems]);

  const handleCancelEditMode = useCallback(() => {
    setMenuItems(loadMenuConfig());
    setEditMode(false);
    setShowAddForm(false);
  }, []);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const menuIds = menuItems.map(m => m.id);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Bus className="h-5 w-5 text-sidebar-primary-foreground shrink-0" />
                  <span className="font-semibold tracking-tight truncate text-sidebar-foreground text-sm flex-1">
                    運行管理
                  </span>
                  {/* 編集モード切替ボタン（管理者のみ） */}
                  {user?.role === "admin" && !editMode && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="h-6 w-6 flex items-center justify-center rounded transition-colors shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent"
                      title="メニューを編集"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {editMode && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={handleSaveEditMode} className="h-6 w-6 flex items-center justify-center rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors" title="保存">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={handleCancelEditMode} className="h-6 w-6 flex items-center justify-center rounded bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors" title="キャンセル">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* 運行情報パネル（メニューの上部に表示） */}
            {!isCollapsed && (
              <SidebarNoticePanel uiSettingsMap={uiSettingsMap} />
            )}
            <SidebarMenu className="px-2 py-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMenuDragEnd}>
                <SortableContext items={menuIds} strategy={verticalListSortingStrategy}>
                  {menuItems.map(item => {
                    const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                    return (
                      <SortableMenuItem
                        key={item.id}
                        item={item}
                        isActive={isActive}
                        editMode={editMode && !isCollapsed}
                        onNavigate={() => setLocation(item.path)}
                        onToggleVisible={() => handleToggleVisible(item.id)}
                        onEditLabel={(newLabel) => handleEditLabel(item.id, newLabel)}
                        onDelete={() => handleDeleteItem(item.id)}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
              {/* 項目追加ボタン（編集モード時） */}
              {editMode && !isCollapsed && (
                showAddForm ? (
                  <AddMenuItemForm onAdd={handleAddItem} onCancel={() => setShowAddForm(false)} />
                ) : (
                  <SidebarMenuItem>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/50 rounded-md transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>メニュー項目を追加</span>
                    </button>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <div className="flex items-center gap-2 px-2 mb-2 group-data-[collapsible=icon]:hidden">
              <CircleDot className="h-3 w-3 text-green-400" />
              <span className="text-xs text-sidebar-foreground/60">認証済み</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-sidebar-accent text-sidebar-accent-foreground">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate mt-1.5">
                      {user?.role === "admin" ? "管理者" : "ユーザー"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>ログアウト</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (isCollapsed) return; setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <span className="tracking-tight text-foreground font-medium">
                  {activeMenuItem?.label ?? "メニュー"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
