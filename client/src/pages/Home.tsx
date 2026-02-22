import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Bus, Monitor, Tablet, MapPin, Settings, ArrowRight } from "lucide-react";

const modules = [
  {
    icon: Monitor,
    title: "管理PC",
    description: "運行管理の中枢。GTFS取込、ダイヤ作成、通話・メッセージ、端末管理を集約。",
    path: "/admin",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Settings,
    title: "初期設定",
    description: "端末ごとの基本設定。系統・車両・ダイヤ・表示モードを選択し各本体へ反映。",
    path: "/setup",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: Tablet,
    title: "運転支援タブレット",
    description: "乗務中の運転手向け。通話・メッセージ・運行情報を最小操作で提供。PWA対応。",
    path: "/tablet",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: MapPin,
    title: "バスロケーション",
    description: "バス位置・運行状況をリアルタイム表示。社内/外部表示の更新周期切替対応。",
    path: "/busloc",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b">
        <div className="container py-16 md:py-24 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bus className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            バス運行管理システム
          </h1>
          <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
            運行管理・運転支援・バスロケーションを統合した
            バス事業者向け運行管理プラットフォーム
          </p>
        </div>
      </div>

      {/* Modules */}
      <div className="container py-12">
        <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
          {modules.map(mod => (
            <Card
              key={mod.path}
              className="group cursor-pointer hover:shadow-lg transition-all border-border/50 hover:border-border"
              onClick={() => setLocation(mod.path)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${mod.bgColor} flex items-center justify-center shrink-0`}>
                    <mod.icon className={`h-6 w-6 ${mod.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{mod.title}</h3>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          バス運行管理システム
        </div>
      </footer>
    </div>
  );
}
