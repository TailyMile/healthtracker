# HealthTracker MVP

Личный веб-инструмент для аналитики физической активности. Приложение собирает данные из Apple Health и Strava, строит отчёты в markdown/JSON и позволяет выгружать их в Google Drive.

## Что входит в MVP
- Dashboard с краткой сводкой и последними велозаездами
- Импорт Apple Health export через UI
- OAuth-подключение Strava
- Генерация отчётов `daily_summary.json`, `weekly_summary.json`, `monthly_summary.json`, `latest_chatgpt_report.md`
- Выгрузка отчётов в Google Drive
- Деплой как web-приложения на Vercel

## Технологии
- Next.js App Router
- TypeScript
- Tailwind CSS
- Route Handlers для API
- Google Drive OAuth + upload
- Vercel Blob как рекомендуемое хранилище для состояния и артефактов проекта

## Локальный запуск
1. Установите зависимости:
   ```bash
   npm install
   ```
2. Создайте `.env.local` на базе `.env.example`.
3. Запустите dev-сервер:
   ```bash
   npm run dev
   ```
4. Откройте `http://localhost:3000`.

## Переменные окружения
Смотрите файл `.env.example`.

## Google Drive OAuth
1. Нажмите `Подключить Google Drive` на странице импорта.
2. Авторизуйте доступ к Google Drive.
3. После callback токены сохраняются в server-side state store и используются для загрузки отчётов.

## Strava OAuth
1. Перейдите на страницу импорта.
2. Нажмите `Подключить Strava`.
3. Завершите OAuth flow и выполните `Sync Strava`.

## Деплой на Vercel
1. Создайте GitHub-репозиторий и запушьте код.
2. Импортируйте репозиторий в Vercel.
3. Добавьте env vars из `.env.example` в Project Settings.
4. Настройте OAuth redirect URLs:
   - `STRAVA_REDIRECT_URI` -> `https://<your-domain>/api/strava/callback`
   - `GOOGLE_REDIRECT_URI` -> `https://<your-domain>/api/drive/callback`
5. Убедитесь, что Vercel Deployment Protection включён для личного доступа.
6. Деплойте проект и проверьте цепочку:
   - загрузка Apple Health файла
   - `Sync Strava`
   - `Сформировать отчёт`
   - `Upload to Google Drive`

## Практическая схема работы
1. Откройте `Импорт`.
2. Загрузите Apple Health export.
3. Подключите и синхронизируйте Strava.
4. Сформируйте отчёт.
5. Скачайте markdown или JSON, при необходимости отправьте в Google Drive.

## Большие Apple Health архивы
- Для крупных `Apple Health` файлов (например, `~140MB`) используется `client upload` в Vercel Blob:
  1. браузер загружает файл напрямую в Blob (`/api/health/upload`);
  2. backend импортирует данные по `blobUrl` (`/api/health/import`).
- Это обходит лимит body для serverless-функций Vercel при прямом form upload.

## Пример отчёта
- Примерные артефакты лежат в директории `examples/`:
  - `latest_chatgpt_report.example.md`
  - `daily_summary.example.json`
  - `weekly_summary.example.json`
  - `monthly_summary.example.json`

## Заметки по архитектуре
- Приложение рассчитано на одного пользователя.
- UI защищён через Vercel Deployment Protection.
- Хранилище MVP — file-based JSON state (`BLOB_STATE_PATH`) с персистентностью в Vercel Blob.
- В проекте предусмотрен лёгкий слой интеграций без тяжёлого backend-фреймворка.
- Отчёты остаются читаемыми вручную и удобными для передачи в ChatGPT.
