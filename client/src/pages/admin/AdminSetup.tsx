import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink, Settings } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminSetup() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">初期設定管理</h1>
        <p className="text-muted-foreground text-sm mt-1">
          端末ごとの初期設定を管理します
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            初期設定画面
          </CardTitle>
          <CardDescription>
            各端末の初期設定は、専用の設定画面から行います。
            設定画面では、端末ID・路線・ダイヤ・表示モード等を選択し、
            localStorageへの保存とサーバーへの反映を行えます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setLocation("/setup")} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            初期設定画面を開く
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
