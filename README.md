# LUMI Mini App

Адаптивный чёрно-белый интерфейс Telegram Mini App. Работает как статический сайт и не требует сборки.

## Возможности

- Telegram WebApp SDK, безопасные поля экрана и основная навигация.
- Чатовый интерфейс и локальная история. Ответы искусственного интеллекта не имитируются: backend пока не подключён.
- Погода Open-Meteo по явному запросу геопозиции.
- Поиск мест через Яндекс Карты.
- Локальные заметки и планы с отметками выполнения.
- Голосовой ввод через Web Speech API, если браузер его поддерживает.
- Голосовой режим с выбором женского или мужского системного голоса; доступность тембров зависит от браузера и устройства.
- Новости Hacker News API; при недоступности показывается ссылка на источник, без выдуманных новостей.
- Монохромные SVG-иконки в стиле Lucide. Библиотека Lucide доступна по лицензии ISC: https://lucide.dev/ и https://github.com/lucide-icons/lucide/blob/main/LICENSE.

## Публикация

В репозитории есть workflow GitHub Actions для GitHub Pages. В настройках репозитория откройте **Settings → Pages** и установите **Build and deployment → Source: GitHub Actions**. После push в `main` адрес проекта обычно `https://aleksdevhub.github.io/lumi-ai/`.

## Telegram

В @BotFather откройте `/mybots` → `@LumiPersonalAI_bot` → **Bot Settings → Menu Button → Configure menu button**. Укажите URL опубликованной страницы и текст кнопки, например `Открыть LUMI`. Если доступен раздел **Mini App**, там же назначьте основное приложение. Токен бота нужен только BotFather и не добавляется в репозиторий.

## Backend модели

GitHub Pages размещает только клиентскую часть. Будущий backend подключается к HTTPS API через `fetch`; храните адрес в конфигурации приложения, а ключ модели — только на сервере. Не помещайте секреты в `app.js`, GitHub Pages или Telegram `initDataUnsafe`. При серверной авторизации проверяйте подпись Telegram `initData` на backend.

Заметки, планы и история сейчас записываются в `localStorage` текущего браузера и не синхронизируются между устройствами.

Голосовой режим сейчас распознаёт речь и может озвучить системное сообщение о том, что backend ещё не подключён. Для настоящего голосового диалога потребуется подключить модельный backend по HTTPS.

## Бесплатный Gemini backend (прототип)

API находится в `worker/`. Worker принимает сообщения только с GitHub Pages origin, проверяет подпись `Telegram.WebApp.initData`, ограничивает размер переписки и хранит ключи в Cloudflare Secrets. Используется Gemini Developer API; квоты и доступность модели зависят от аккаунта/региона. Бесплатные запросы Gemini могут использоваться Google для улучшения продуктов и проверяться людьми — не отправляйте через бесплатный уровень конфиденциальные или личные сведения. См. [тарифы](https://ai.google.dev/gemini-api/docs/pricing) и [условия обработки данных](https://ai.google.dev/gemini-api/terms). Существующий проект Google AI Studio в рамках этой разработки менять не нужно; для доступа к API создайте отдельный проект и ключ.

### Настройка

1. В Cloudflare Dashboard создайте Worker с именем `lumi-ai-api` и разверните код из `worker/src/index.js` (или из CLI из папки `worker`: `npx wrangler deploy`). На бесплатном плане указано до 100 000 запросов Worker в день; квота модели отдельная. См. [лимиты и тариф Workers](https://developers.cloudflare.com/workers/platform/pricing/).
2. В **Worker → Settings → Variables and Secrets** добавьте обычную переменную `ALLOWED_ORIGIN` со значением `https://aleksdevhub.github.io` и секреты `GEMINI_API_KEY` и `TELEGRAM_BOT_TOKEN`. Не помещайте секреты в GitHub. Cloudflare хранит Worker secrets как зашифрованные значения; см. [документацию Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
3. В `api-config.js` укажите адрес Worker, например `https://lumi-ai-api.<ваш-account>.workers.dev`, затем отправьте обновление в `main`. Endpoint будет `/chat`; проверка доступности — `/health`.
4. Откройте Mini App из Telegram и проверьте текстовый и голосовой обмен.

Worker конфигурирован для текущего публичного Pages origin `https://aleksdevhub.github.io`. Для локальной разработки или смены домена измените `ALLOWED_ORIGIN` в `worker/wrangler.jsonc`. Нужен валидный bot token для проверки Telegram initData; вводите его только в секреты Cloudflare, не присылайте в чат.
