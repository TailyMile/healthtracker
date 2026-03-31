import { PageHero, Button } from "@/components/ui";
import { DashboardClient } from "@/components/dashboard-client";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Dashboard"
        title="Контроль тренировок, восстановления и веса"
        description="Здесь собираются сводка по поездкам, текущий вес и последние активности. Импортируйте Apple Health, синхронизируйте Strava и получайте понятный отчёт для анализа в ChatGPT."
        actions={[
          <Button key="import" href="/import">Перейти к импорту</Button>,
          <Button key="reports" href="/reports" variant="ghost">Открыть отчёты</Button>,
        ]}
      />
      <DashboardClient />
    </div>
  );
}
