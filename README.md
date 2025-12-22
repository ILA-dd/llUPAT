# 🎮 llUPAT Clan Website

DDNet клан llUPAT - сайт с Firebase авторизацией и Discord интеграцией.

---

## 📁 Структура проекта

```
llupat-vercel/
├── api/
│   ├── avatar.js      # Discord Avatar API (серверный код)
│   └── health.js      # Health check endpoint
├── public/
│   └── index.html     # Основной сайт
├── vercel.json        # Конфигурация Vercel
├── package.json       # Метаданные проекта
└── README.md          # Этот файл
```

---

## 🚀 Деплой на Vercel

### Шаг 1: Загрузка проекта

**Вариант A: Через GitHub**
1. Создай репозиторий на GitHub
2. Загрузи все файлы из этой папки
3. На [vercel.com](https://vercel.com) нажми "Add New → Project"
4. Импортируй репозиторий

**Вариант B: Через Vercel CLI**
```bash
npm i -g vercel
cd llupat-vercel
vercel
```

**Вариант C: Drag & Drop**
1. Зайди на [vercel.com](https://vercel.com)
2. Перетащи папку `llupat-vercel` в браузер

---

### Шаг 2: Настройка Environment Variables

⚠️ **ВАЖНО! Без этого шага аватары Discord не будут работать!**

1. В Vercel открой свой проект
2. Перейди в **Settings → Environment Variables**
3. Добавь переменную:

| Name | Value |
|------|-------|
| `DISCORD_BOT_TOKEN` | `твой_токен_бота` |

4. Отметь галочки: ✅ Production, ✅ Preview, ✅ Development
5. Нажми **Save**
6. **Redeploy** проект (Deployments → ... → Redeploy)

---

### Шаг 3: Настройка Firebase App Check

В Firebase Console уже настроен App Check. Убедись что:

1. В Firebase Console → App Check добавлен секретный ключ reCAPTCHA
2. Домены твоего Vercel проекта добавлены в reCAPTCHA Admin Console

---

## 🔒 Безопасность

### Токен Discord бота
- ✅ Хранится в Vercel Environment Variables
- ✅ Никогда не попадает в клиентский код
- ✅ Доступен только на сервере через `process.env.DISCORD_BOT_TOKEN`

### Firebase
- ✅ App Check включен (reCAPTCHA v3)
- ✅ Security Rules настроены (см. SECURITY_GUIDE.md)

### API защита
- ✅ Rate limiting (60 запросов/минуту на IP)
- ✅ CORS whitelist
- ✅ Валидация входных данных

---

## 🔧 Локальная разработка

1. Установи [Vercel CLI](https://vercel.com/docs/cli):
```bash
npm i -g vercel
```

2. Залинкуй проект:
```bash
vercel link
```

3. Получи Environment Variables:
```bash
vercel env pull .env.local
```

4. Запусти локально:
```bash
vercel dev
```

Сайт будет доступен на http://localhost:3000

---

## 📝 API Endpoints

### GET /api/avatar
Получение аватара Discord пользователя.

**Параметры:**
- `id` (required) - Discord User ID (17-19 цифр)
- `size` (optional) - Размер аватара (16-4096, default: 256)

**Пример:**
```
GET /api/avatar?id=123456789012345678&size=128
```

**Ответ:**
```json
{
  "userId": "123456789012345678",
  "username": "PlayerName",
  "globalName": "Display Name",
  "avatar": "abc123hash",
  "avatarUrl": "https://cdn.discordapp.com/avatars/...",
  "isDefault": false
}
```

### GET /api/health
Проверка статуса API.

**Ответ:**
```json
{
  "status": "ok",
  "service": "llUPAT Clan API",
  "version": "1.0.0"
}
```

---

## ❓ Troubleshooting

### Аватары не загружаются
1. Проверь что `DISCORD_BOT_TOKEN` добавлен в Vercel Environment Variables
2. Сделай Redeploy после добавления переменной
3. Проверь /api/health - должен возвращать `"status": "ok"`

### Ошибки Firebase
1. Проверь что App Check настроен правильно
2. Домен добавлен в reCAPTCHA Admin Console
3. Security Rules опубликованы

### CORS ошибки
Добавь свой домен в массив `ALLOWED_ORIGINS` в `api/avatar.js`

---

## 📞 Поддержка

Создано с ❤️ для llUPAT Clan
