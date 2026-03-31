import { PageHero, Button } from "@/components/ui";
import { ReportsClient } from "@/components/reports-client";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Отчёты"
        title="Markdown отчёт, JSON-сводки и выгрузка в Google Drive"
        description="Сформируйте отчёт, посмотрите markdown прямо в браузере и скачайте .md/.json. По желанию выгрузите актуальную версию в Google Drive."
        actions={[
          <Button key="import" href="/import" variant="ghost">Вернуться к импорту</Button>,
          <Button key="generate" href="#report">Сгенерировать отчёт</Button>,
        ]}
      />
      <div id="report">
        <ReportsClient />
      </div>
    </div>
  );
}
