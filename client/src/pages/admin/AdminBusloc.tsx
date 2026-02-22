import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react";
import { Bus, RefreshCw, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useLocation } from "wouter";

type SortKey = "diaName" | "vehicleId";
type SortDir = "asc" | "desc";

export default function AdminBusloc() {
  const [, setLocation] = useLocation();
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("vehicleId");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: routes } = trpc.gtfs.getRoutes.useQuery();
  const { data: locations, refetch } = trpc.busLocation.getByRoute.useQuery(
    { routeId: selectedRouteId },
    { enabled: !!selectedRouteId, refetchInterval: 5000 }
  );
  const { data: allLocations, refetch: refetchAll } = trpc.busLocation.getAll.useQuery(
    undefined,
    { enabled: !selectedRouteId, refetchInterval: 5000 }
  );

  useEffect(() => {
    if (routes && routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].routeId);
    }
  }, [routes, selectedRouteId]);

  const rawLocations = selectedRouteId ? (locations ?? []) : (allLocations ?? []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedLocations = [...rawLocations].sort((a, b) => {
    const av = ((a as any)[sortKey] ?? a.deviceId ?? "").toString().toLowerCase();
    const bv = ((b as any)[sortKey] ?? b.deviceId ?? "").toString().toLowerCase();
    return sortDir === "asc" ? av.localeCompare(bv, "ja") : bv.localeCompare(av, "ja");
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40 inline" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary inline" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary inline" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">バスロケーション</h1>
          <p className="text-muted-foreground text-sm mt-1">車両位置・運行状況の監視</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLocation("/busloc")}>
          <ExternalLink className="h-4 w-4 mr-1" /> 外部表示を開く
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="路線を選択" />
          </SelectTrigger>
          <SelectContent>
            {routes?.map(r => (
              <SelectItem key={r.routeId} value={r.routeId}>
                {r.routeShortName ?? r.routeId} - {r.routeLongName ?? ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => { refetch(); refetchAll(); }}>
          <RefreshCw className="h-4 w-4 mr-1" /> 更新
        </Button>
        <span className="text-sm text-muted-foreground">5秒ごとに自動更新</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" />
            車両一覧 ({sortedLocations.length}台)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedLocations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="text-base">
                  <TableHead
                    className="cursor-pointer select-none font-bold text-base"
                    onClick={() => handleSort("diaName")}
                  >
                    ダイヤ<SortIcon col="diaName" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none font-bold text-base"
                    onClick={() => handleSort("vehicleId")}
                  >
                    車両<SortIcon col="vehicleId" />
                  </TableHead>
                  <TableHead className="font-bold text-base">乗務員名</TableHead>
                  <TableHead className="font-bold text-base">現在地</TableHead>
                  <TableHead className="font-bold text-base">次停留所</TableHead>
                  <TableHead className="font-bold text-base">遅延</TableHead>
                  <TableHead className="font-bold text-base">速度</TableHead>
                  <TableHead className="font-bold text-base">更新時刻</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLocations.map((loc, idx) => (
                  <TableRow key={(loc as any).id ?? loc.deviceId ?? idx} className="text-base">
                    <TableCell className="font-bold text-base">
                      {(loc as any).diaName ?? <span className="text-muted-foreground text-sm">-</span>}
                    </TableCell>
                    <TableCell className="font-bold text-lg">
                      {loc.vehicleId ?? loc.deviceId}
                    </TableCell>
                    <TableCell className="text-base">
                      {(loc as any).driverName ?? <span className="text-muted-foreground text-sm">-</span>}
                    </TableCell>
                    <TableCell className="text-base">{loc.currentStopId ?? "-"}</TableCell>
                    <TableCell className="text-base">{loc.nextStopId ?? "-"}</TableCell>
                    <TableCell>
                      {loc.delayMinutes != null ? (
                        <span className={`text-base font-semibold ${loc.delayMinutes > 5 ? "text-red-600" : loc.delayMinutes > 0 ? "text-yellow-600" : "text-green-600"}`}>
                          {loc.delayMinutes <= 0 ? "定刻" : `+${loc.delayMinutes}分`}
                        </span>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-base">
                      {loc.speed != null ? `${loc.speed} km/h` : "-"}
                    </TableCell>
                    <TableCell className="text-base text-muted-foreground">
                      {loc.updatedAt ? new Date(loc.updatedAt).toLocaleTimeString("ja-JP") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <Bus className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">運行中の車両はありません</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
