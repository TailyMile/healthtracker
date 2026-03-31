import { PageHero, Button } from "@/components/ui";
import { ImportClient } from "@/components/import-client";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Импорт данных"
        title="Загрузите Apple Health export и подключите Strava"
        description="Поддерживаются XML, CSV, JSON и ZIP-архивы с Apple Health export.xml. После этого можно запускать синхронизацию Strava и строить отчёты."
        actions={[
          <Button key="drive" href="/api/drive/connect" variant="ghost">Подключить Google Drive</Button>,
          <Button key="reports" href="/reports">К отчётам</Button>,
        ]}
      />
      <ImportClient />
    </div>
  );
}
