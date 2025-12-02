# Offline Registration Backend

Backend API для системы офлайн-регистрации участников. Построен на Express.js с использованием TypeScript, Knex.js и PostgreSQL.

## Технологический стек

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Query Builder**: Knex.js
- **Authentication**: JWT (Access + Refresh tokens)
- **Validation**: express-validator
- **Password Hashing**: bcrypt

## Архитектура

Проект использует многоуровневую архитектуру:

```
#src/
├── config/          # Конфигурация (БД, внешние сервисы)
├── dal/             # Data Access Layer (работа с БД)
├── middlewares/     # Express middleware
├── models/          # Типы и модели данных
├── routes/          # Определение роутов
├── services/        # Бизнес-логика
└── utils/           # Вспомогательные функции
```

## Требования

- Node.js >= 16.x
- PostgreSQL >= 12.x
- Yarn или npm

## Установка

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd back
```

### 2. Установка зависимостей

```bash
yarn install
# или
npm install
```

### 3. Настройка окружения

Создайте файл `.env` в корне проекта:

```env
# Database
DB_ENV_HOST=localhost
DB_ENV_PORT=5432
DB_ENV_NAME=offline_registration
DB_ENV_USER=postgres
DB_ENV_PASSWORD=your_password

# JWT Secrets
JWT_ACCESS_SECRET=your_access_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here

# Server
PORT=3000
NODE_ENV=development
```

### 4. Создание базы данных

```bash
# Подключитесь к PostgreSQL
psql -U postgres

# Создайте базу данных
CREATE DATABASE offline_registration;
```

### 5. Применение миграций

```bash
yarn migrate
```

### 6. Создание начальных данных (seeds)

```bash
yarn seed
```

По умолчанию будет создан администратор:
- **Login**: admin
- **Password**: admin123

## Запуск

### Development

```bash
yarn dev
```

Сервер запустится на `http://localhost:3000` с hot reload.

### Production

```bash
# Сборка
yarn build

# Запуск через PM2
pm2 start ecosystem.config.js
```

## Доступные команды

| Команда | Описание |
|---------|----------|
| `yarn dev` | Запуск в режиме разработки |
| `yarn build` | Сборка проекта и деплой через PM2 |
| `yarn compts` | Компиляция TypeScript в watch-режиме |
| `yarn migrate` | Применить миграции БД |
| `yarn migrate:rollback` | Откатить последнюю миграцию |
| `yarn migrate:make <name>` | Создать новую миграцию |
| `yarn seed` | Применить seeds |
| `yarn seed:make <name>` | Создать новый seed |

## Миграции и Seeds

### Создание миграции

```bash
yarn migrate:make create_users_table
```

### Применение миграций

Миграции применяются автоматически при старте приложения в development-режиме.

Вручную:
```bash
yarn migrate
```

### Откат миграции

```bash
yarn migrate:rollback
```

### Seeds

Seeds применяются автоматически при старте в development-режиме (`NODE_ENV !== 'production'`).

## Структура проекта

```
back/
├── #src/                    # Исходный код
│   ├── config/             # Конфигурация
│   │   ├── db.ts          # Настройка Knex
│   │   └── tinyPng.ts     # Внешние сервисы
│   ├── dal/               # Data Access Layer
│   │   ├── _baseDAL.ts    # Базовый класс для работы с БД
│   │   └── accountsDAL.ts # DAL для аккаунтов
│   ├── middlewares/       # Middleware
│   │   ├── common/        # Общие middleware
│   │   └── accounts/      # Middleware для аккаунтов
│   ├── models/            # Модели данных
│   │   └── accounts.ts    # Интерфейс и хелперы Account
│   ├── routes/            # Роуты
│   │   └── accountsRouter.ts
│   ├── services/          # Бизнес-логика
│   │   └── accountService.ts
│   ├── utils/             # Утилиты
│   │   ├── JWTutils.ts    # JWT токены
│   │   ├── errors.ts      # Обработка ошибок
│   │   └── ...
│   └── index.ts           # Точка входа
├── migrations/            # Миграции БД
├── seeds/                 # Начальные данные
├── types/                 # Дополнительные типы TypeScript
├── dist/                  # Скомпилированный код (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Роли пользователей

- **admin** - Администратор (полный доступ)
- **operator** - Оператор (ограниченный доступ)

## Аутентификация

Проект использует JWT-токены с механизмом refresh:

1. **Access Token** - короткоживущий (15 минут)
2. **Refresh Token** - долгоживущий (60 дней)

При истечении access-токена клиент должен использовать refresh-токен для получения нового access-токена.

## API Documentation

Смотрите [API.md](./API.md) для подробного описания всех эндпоинтов.

## Безопасность

- Пароли хешируются с использованием bcrypt
- JWT токены с уникальными секретами для access и refresh
- Параметризованные SQL-запросы через Knex (защита от SQL-инъекций)
- Валидация входных данных через express-validator
- CORS настроен для всех источников (настройте для production)

## Переменные окружения

| Переменная | Описание | Обязательна |
|-----------|----------|-------------|
| `DB_ENV_HOST` | Хост PostgreSQL | Да |
| `DB_ENV_PORT` | Порт PostgreSQL | Нет (5432) |
| `DB_ENV_NAME` | Имя базы данных | Да |
| `DB_ENV_USER` | Пользователь БД | Да |
| `DB_ENV_PASSWORD` | Пароль БД | Да |
| `JWT_ACCESS_SECRET` | Секрет для access токенов | Да |
| `JWT_REFRESH_SECRET` | Секрет для refresh токенов | Да |
| `PORT` | Порт сервера | Нет (3000) |
| `NODE_ENV` | Окружение (development/production) | Нет |

## Troubleshooting

### Ошибка подключения к БД

Проверьте:
1. Запущен ли PostgreSQL
2. Правильность credentials в `.env`
3. Существует ли база данных

### TypeScript не видит кастомные типы Express

Перезапустите TypeScript сервер:
```
Ctrl+Shift+P -> TypeScript: Restart TS Server
```

### Миграции не применяются

```bash
# Проверьте статус миграций
npx knex migrate:status

# Примените вручную
yarn migrate
```

## Лицензия

MIT
