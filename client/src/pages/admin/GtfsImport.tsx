import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, MapPin, Bus, Clock, CheckCircle, AlertCircle, Loader2, Database } from "lucide-react";

type ImportMode = "append" | "delete" | "overwrite";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
    return obj;
  });
}

const MODE_OPTIONS: { value: ImportMode; label: string; description: string; color: string }[] = [
  { value: "append",    label: "追加",   description: "既存データを保持し、新規データを追加・更新します",   color: "text-green-700" },
  { value: "overwrite", label: "上書き", description: "既存データを全削除してから新規データを取り込みます", color: "text-orange-700" },
  { value: "delete",    label: "削除",   description: "既存データをすべて削除します（CSVは不要）",          color: "text-red-700" },
];

export default function GtfsImport() {
  const [routesCsv, setRoutesCsv] = useState("");
  const [stopsCsv, setStopsCsv] = useState("");
  const [tripsCsv, setTripsCsv] = useState("");
  const [stopTimesCsv, setStopTimesCsv] = useState("");
  const [routesMode, setRoutesMode] = useState<ImportMode>("append");
  const [stopsMode, setStopsMode] = useState<ImportMode>("append");
  const [tripsMode, setTripsMode] = useState<ImportMode>("append");
  const [stopTimesMode, setStopTimesMode] = useState<ImportMode>("append");
  const [importStatus, setImportStatus] = useState<Record<string, { status: "idle" | "loading" | "success" | "error"; count?: number; error?: string }>>({
    routes: { status: "idle" },
    stops: { status: "idle" },
    trips: { status: "idle" },
    stopTimes: { status: "idle" },
  });
  const [dataTab, setDataTab] = useState<"routes" | "stops" | "trips" | "stopTimes">("routes");

  const { data: existingRoutes, refetch: refetchRoutes } = trpc.gtfs.getRoutes.useQuery();
  const { data: existingTrips, refetch: refetchTrips } = trpc.gtfs.getTrips.useQuery();
  const { data: existingStops, refetch: refetchStops } = trpc.gtfs.getStops.useQuery();
  const { data: existingStopTimes, refetch: refetchStopTimes } = trpc.gtfs.getAllStopTimes.useQuery();
  const importRoutesMut = trpc.gtfs.importRoutes.useMutation();
  const importStopsMut = trpc.gtfs.importStops.useMutation();
  const importTripsMut = trpc.gtfs.importTrips.useMutation();
  const importStopTimesMut = trpc.gtfs.importStopTimes.useMutation();

  const handleFileUpload = useCallback((setter: (v: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => setter(reader.result as string);
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  const handleImportRoutes = async () => {
    try {
      setImportStatus(prev => ({ ...prev, routes: { status: "loading" } }));
      if (routesMode === "delete") {
        await importRoutesMut.mutateAsync({ routes: [], mode: "delete" });
        setImportStatus(prev => ({ ...prev, routes: { status: "success", count: 0 } }));
        toast.success("路線データを全削除しました"); refetchRoutes(); return;
      }
      const parsed = parseCsv(routesCsv);
      if (parsed.length === 0) { toast.error("データが空です"); setImportStatus(prev => ({ ...prev, routes: { status: "idle" } })); return; }
      const routesData = parsed.map(r => ({
        routeId: r.route_id || r.routeId || "",
        routeShortName: r.route_short_name || r.routeShortName || undefined,
        routeLongName: r.route_long_name || r.routeLongName || undefined,
        routeType: r.route_type ? parseInt(r.route_type) : undefined,
        routeColor: r.route_color || r.routeColor || undefined,
      })).filter(r => r.routeId);
      const result = await importRoutesMut.mutateAsync({ routes: routesData, mode: routesMode });
      setImportStatus(prev => ({ ...prev, routes: { status: "success", count: result.count } }));
      toast.success(`${result.count}件の路線を取り込みました`); refetchRoutes();
    } catch (e: any) {
      setImportStatus(prev => ({ ...prev, routes: { status: "error", error: e.message } }));
      toast.error("路線の取込に失敗しました");
    }
  };

  const handleImportStops = async () => {
    try {
      setImportStatus(prev => ({ ...prev, stops: { status: "loading" } }));
      if (stopsMode === "delete") {
        await importStopsMut.mutateAsync({ stops: [], mode: "delete" });
        setImportStatus(prev => ({ ...prev, stops: { status: "success", count: 0 } }));
        toast.success("停留所データを全削除しました"); refetchStops(); return;
      }
      const parsed = parseCsv(stopsCsv);
      if (parsed.length === 0) { toast.error("データが空です"); setImportStatus(prev => ({ ...prev, stops: { status: "idle" } })); return; }
      const stopsData = parsed.map(s => ({
        stopId: s.stop_id || s.stopId || "",
        stopName: s.stop_name || s.stopName || "",
        stopLat: s.stop_lat || s.stopLat || undefined,
        stopLon: s.stop_lon || s.stopLon || undefined,
        routeId: s.route_id || s.routeId || undefined,
      })).filter(s => s.stopId && s.stopName);
      const result = await importStopsMut.mutateAsync({ stops: stopsData, mode: stopsMode });
      setImportStatus(prev => ({ ...prev, stops: { status: "success", count: result.count } }));
      toast.success(`${result.count}件の停留所を取り込みました`); refetchStops();
    } catch (e: any) {
      setImportStatus(prev => ({ ...prev, stops: { status: "error", error: e.message } }));
      toast.error("停留所の取込に失敗しました");
    }
  };

  const handleImportTrips = async () => {
    try {
      setImportStatus(prev => ({ ...prev, trips: { status: "loading" } }));
      if (tripsMode === "delete") {
        await importTripsMut.mutateAsync({ trips: [], mode: "delete" });
        setImportStatus(prev => ({ ...prev, trips: { status: "success", count: 0 } }));
        toast.success("便データを全削除しました"); refetchTrips(); return;
      }
      const parsed = parseCsv(tripsCsv);
      if (parsed.length === 0) { toast.error("データが空です"); setImportStatus(prev => ({ ...prev, trips: { status: "idle" } })); return; }
      const tripsData = parsed.map(t => ({
        tripId: t.trip_id || t.tripId || "",
        routeId: t.route_id || t.routeId || "",
        serviceId: t.service_id || t.serviceId || undefined,
        tripHeadsign: t.trip_headsign || t.tripHeadsign || undefined,
        directionId: t.direction_id ? parseInt(t.direction_id) : undefined,
      })).filter(t => t.tripId && t.routeId);
      const result = await importTripsMut.mutateAsync({ trips: tripsData, mode: tripsMode });
      setImportStatus(prev => ({ ...prev, trips: { status: "success", count: result.count } }));
      toast.success(`${result.count}件の便を取り込みました`); refetchTrips();
    } catch (e: any) {
      setImportStatus(prev => ({ ...prev, trips: { status: "error", error: e.message } }));
      toast.error("便の取込に失敗しました");
    }
  };

  const handleImportStopTimes = async () => {
    try {
      setImportStatus(prev => ({ ...prev, stopTimes: { status: "loading" } }));
      if (stopTimesMode === "delete") {
        await importStopTimesMut.mutateAsync({ stopTimes: [], mode: "delete" });
        setImportStatus(prev => ({ ...prev, stopTimes: { status: "success", count: 0 } }));
        toast.success("時刻表データを全削除しました"); refetchStopTimes(); return;
      }
      const parsed = parseCsv(stopTimesCsv);
      if (parsed.length === 0) { toast.error("データが空です"); setImportStatus(prev => ({ ...prev, stopTimes: { status: "idle" } })); return; }
      const stData = parsed.map(st => ({
        tripId: st.trip_id || st.tripId || "",
        stopId: st.stop_id || st.stopId || "",
        arrivalTime: st.arrival_time || st.arrivalTime || undefined,
        departureTime: st.departure_time || st.departureTime || undefined,
        stopSequence: parseInt(st.stop_sequence || st.stopSequence || "0"),
      })).filter(st => st.tripId && st.stopId);
      const result = await importStopTimesMut.mutateAsync({ stopTimes: stData, mode: stopTimesMode });
      setImportStatus(prev => ({ ...prev, stopTimes: { status: "success", count: result.count } }));
      toast.success(`${result.count}件の時刻表を取り込みました`); refetchStopTimes();
    } catch (e: any) {
      setImportStatus(prev => ({ ...prev, stopTimes: { status: "error", error: e.message } }));
      toast.error("時刻表の取込に失敗しました");
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "loading") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (status === "success") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "error") return <AlertCircle className="h-4 w-4 text-destructive" />;
    return null;
  };

  const ModeSelector = ({ value, onChange }: { value: ImportMode; onChange: (v: ImportMode) => void }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">取込モード</Label>
      <Select value={value} onValueChange={v => onChange(v as ImportMode)}>
        <SelectTrigger className="w-44 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODE_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className={`font-medium ${opt.color}`}>{opt.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{MODE_OPTIONS.find(o => o.value === value)?.description}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">GTFSデータ取込</h1>
        <p className="text-muted-foreground text-sm mt-1">
          GTFS形式のCSVデータ（routes, stops, trips, stop_times）を取り込みます
        </p>
      </div>

      {/* Summary Cards - クリックで下の一覧タブを切り替え */}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { key: "routes" as const, label: "路線", icon: <FileSpreadsheet className="h-5 w-5 text-primary" />, count: existingRoutes?.length ?? 0 },
          { key: "stops" as const, label: "停留所", icon: <MapPin className="h-5 w-5 text-primary" />, count: existingStops?.length ?? 0 },
          { key: "trips" as const, label: "便", icon: <Bus className="h-5 w-5 text-primary" />, count: existingTrips?.length ?? 0 },
          { key: "stopTimes" as const, label: "時刻表", icon: <Clock className="h-5 w-5 text-primary" />, count: existingStopTimes?.length ?? 0 },
        ].map(item => (
          <Card
            key={item.key}
            className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${dataTab === item.key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setDataTab(item.key)}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-2xl font-bold">{item.count}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Import Tabs */}
      <Tabs defaultValue="routes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="routes" className="gap-1"><StatusIcon status={importStatus.routes.status} />路線</TabsTrigger>
          <TabsTrigger value="stops" className="gap-1"><StatusIcon status={importStatus.stops.status} />停留所</TabsTrigger>
          <TabsTrigger value="trips" className="gap-1"><StatusIcon status={importStatus.trips.status} />便</TabsTrigger>
          <TabsTrigger value="stopTimes" className="gap-1"><StatusIcon status={importStatus.stopTimes.status} />時刻表</TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">路線データ (routes.txt)</CardTitle>
              <CardDescription>route_id, route_short_name, route_long_name, route_type, route_color</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ModeSelector value={routesMode} onChange={setRoutesMode} />
              {routesMode !== "delete" && (
                <>
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={() => handleFileUpload(setRoutesCsv)}>
                      <Upload className="h-4 w-4 mr-1" /> ファイル選択
                    </Button>
                    {importStatus.routes.count !== undefined && <Badge variant="secondary">{importStatus.routes.count}件取込済み</Badge>}
                  </div>
                  <Textarea placeholder="CSVデータを貼り付けるか、ファイルを選択してください..." value={routesCsv} onChange={e => setRoutesCsv(e.target.value)} rows={8} className="font-mono text-xs" />
                  {importStatus.routes.error && <p className="text-sm text-destructive">{importStatus.routes.error}</p>}
                </>
              )}
              <Button onClick={handleImportRoutes} disabled={importRoutesMut.isPending || (routesMode !== "delete" && !routesCsv)} variant={routesMode === "delete" ? "destructive" : "default"}>
                {importRoutesMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {routesMode === "delete" ? "全削除実行" : "取込実行"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stops">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">停留所データ (stops.txt)</CardTitle>
              <CardDescription>stop_id, stop_name, stop_lat, stop_lon, route_id</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ModeSelector value={stopsMode} onChange={setStopsMode} />
              {stopsMode !== "delete" && (
                <>
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={() => handleFileUpload(setStopsCsv)}>
                      <Upload className="h-4 w-4 mr-1" /> ファイル選択
                    </Button>
                    {importStatus.stops.count !== undefined && <Badge variant="secondary">{importStatus.stops.count}件取込済み</Badge>}
                  </div>
                  <Textarea placeholder="CSVデータを貼り付けるか、ファイルを選択してください..." value={stopsCsv} onChange={e => setStopsCsv(e.target.value)} rows={8} className="font-mono text-xs" />
                  {importStatus.stops.error && <p className="text-sm text-destructive">{importStatus.stops.error}</p>}
                </>
              )}
              <Button onClick={handleImportStops} disabled={importStopsMut.isPending || (stopsMode !== "delete" && !stopsCsv)} variant={stopsMode === "delete" ? "destructive" : "default"}>
                {importStopsMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {stopsMode === "delete" ? "全削除実行" : "取込実行"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trips">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">便データ (trips.txt)</CardTitle>
              <CardDescription>trip_id, route_id, service_id, trip_headsign, direction_id</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ModeSelector value={tripsMode} onChange={setTripsMode} />
              {tripsMode !== "delete" && (
                <>
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={() => handleFileUpload(setTripsCsv)}>
                      <Upload className="h-4 w-4 mr-1" /> ファイル選択
                    </Button>
                    {importStatus.trips.count !== undefined && <Badge variant="secondary">{importStatus.trips.count}件取込済み</Badge>}
                  </div>
                  <Textarea placeholder="CSVデータを貼り付けるか、ファイルを選択してください..." value={tripsCsv} onChange={e => setTripsCsv(e.target.value)} rows={8} className="font-mono text-xs" />
                  {importStatus.trips.error && <p className="text-sm text-destructive">{importStatus.trips.error}</p>}
                </>
              )}
              <Button onClick={handleImportTrips} disabled={importTripsMut.isPending || (tripsMode !== "delete" && !tripsCsv)} variant={tripsMode === "delete" ? "destructive" : "default"}>
                {importTripsMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {tripsMode === "delete" ? "全削除実行" : "取込実行"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stopTimes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">時刻表データ (stop_times.txt)</CardTitle>
              <CardDescription>trip_id, stop_id, arrival_time, departure_time, stop_sequence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ModeSelector value={stopTimesMode} onChange={setStopTimesMode} />
              {stopTimesMode !== "delete" && (
                <>
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={() => handleFileUpload(setStopTimesCsv)}>
                      <Upload className="h-4 w-4 mr-1" /> ファイル選択
                    </Button>
                    {importStatus.stopTimes.count !== undefined && <Badge variant="secondary">{importStatus.stopTimes.count}件取込済み</Badge>}
                  </div>
                  <Textarea placeholder="CSVデータを貼り付けるか、ファイルを選択してください..." value={stopTimesCsv} onChange={e => setStopTimesCsv(e.target.value)} rows={8} className="font-mono text-xs" />
                  {importStatus.stopTimes.error && <p className="text-sm text-destructive">{importStatus.stopTimes.error}</p>}
                </>
              )}
              <Button onClick={handleImportStopTimes} disabled={importStopTimesMut.isPending || (stopTimesMode !== "delete" && !stopTimesCsv)} variant={stopTimesMode === "delete" ? "destructive" : "default"}>
                {importStopTimesMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {stopTimesMode === "delete" ? "全削除実行" : "取込実行"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 取込済みデータ一覧 - タブ切り替え */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            取込済みデータ一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={dataTab} onValueChange={v => setDataTab(v as typeof dataTab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="routes">路線 ({existingRoutes?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="stops">停留所 ({existingStops?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="trips">便 ({existingTrips?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="stopTimes">時刻表 ({existingStopTimes?.length ?? 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="routes">
              {existingRoutes && existingRoutes.length > 0 ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>路線ID</TableHead><TableHead>略称</TableHead><TableHead>路線名</TableHead><TableHead>種別</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {existingRoutes.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.routeId}</TableCell>
                        <TableCell>{r.routeShortName ?? "-"}</TableCell>
                        <TableCell>{r.routeLongName ?? "-"}</TableCell>
                        <TableCell>{r.routeType ?? 3}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground py-4 text-center">路線データがありません</p>}
            </TabsContent>

            <TabsContent value="stops">
              {existingStops && existingStops.length > 0 ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>停留所ID</TableHead><TableHead>停留所名</TableHead><TableHead>緯度</TableHead><TableHead>経度</TableHead><TableHead>路線ID</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {existingStops.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.stopId}</TableCell>
                        <TableCell>{s.stopName}</TableCell>
                        <TableCell className="font-mono text-xs">{s.stopLat ?? "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{s.stopLon ?? "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{s.routeId ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground py-4 text-center">停留所データがありません</p>}
            </TabsContent>

            <TabsContent value="trips">
              {existingTrips && existingTrips.length > 0 ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>便ID</TableHead><TableHead>路線ID</TableHead><TableHead>サービスID</TableHead><TableHead>行先</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {existingTrips.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.tripId}</TableCell>
                        <TableCell className="font-mono text-xs">{t.routeId}</TableCell>
                        <TableCell className="font-mono text-xs">{t.serviceId ?? "-"}</TableCell>
                        <TableCell>{t.tripHeadsign ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground py-4 text-center">便データがありません</p>}
            </TabsContent>

            <TabsContent value="stopTimes">
              {existingStopTimes && existingStopTimes.length > 0 ? (
                <>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>便ID</TableHead><TableHead>停留所ID</TableHead><TableHead>到着時刻</TableHead><TableHead>出発時刻</TableHead><TableHead>順序</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {existingStopTimes.slice(0, 200).map((st, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{st.tripId}</TableCell>
                          <TableCell className="font-mono text-xs">{st.stopId}</TableCell>
                          <TableCell className="font-mono text-xs">{st.arrivalTime ?? "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{st.departureTime ?? "-"}</TableCell>
                          <TableCell>{st.stopSequence}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {existingStopTimes.length > 200 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">（先頭200件を表示、全{existingStopTimes.length}件）</p>
                  )}
                </>
              ) : <p className="text-sm text-muted-foreground py-4 text-center">時刻表データがありません</p>}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
