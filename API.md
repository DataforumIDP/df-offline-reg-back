# API Documentation

Base URL: `http://localhost:3000`

## Authentication

Все защищенные эндпоинты требуют JWT токен в заголовке:

```
Authorization: Bearer <access_token>
```

## Endpoints

### Accounts

#### 1. Регистрация нового аккаунта

```http
POST /accounts
```

**Body:**
```json
{
  "login": "user@example.com",
  "password": "password123",
  "name": "Имя пользователя",
  "role": "operator" // опционально
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "login": "user@example.com",
  "name": "Имя пользователя",
  "role": "operator"
}
```

**Validation:**
- `login`: обязательное поле, строка
- `password`: опционально, строка (если не указан - генерируется автоматически)
- `name`: опционально, строка
- `role`: опционально, должно быть "admin" или "operator"

---

#### 2. Авторизация (все роли)

```http
POST /accounts/auth/operator
```

**Body:**
```json
{
  "login": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Вход выполнен успешно",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "account": {
    "id": 1,
    "login": "user@example.com",
    "name": "Имя пользователя",
    "role": "operator"
  }
}
```

**Errors:**
- `401 Unauthorized` - Некорректный логин или пароль

**Notes:**
- `accessToken` действителен 15 минут
- `refreshToken` действителен 60 дней

---

#### 3. Авторизация (только администраторы)

```http
POST /accounts/auth/admin
```

**Body:**
```json
{
  "login": "admin@example.com",
  "password": "admin123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Вход выполнен успешно",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "account": {
    "id": 1,
    "login": "admin@example.com",
    "name": "Администратор",
    "role": "admin"
  }
}
```

**Errors:**
- `401 Unauthorized` - Пользователь не является администратором или неверные credentials

---

#### 4. Обновление токена

```http
POST /accounts/auth/refresh
```

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:** `200 OK`
```json
{
  "message": "Токен обновлен успешно",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "account": {
    "id": 1,
    "login": "user@example.com",
    "name": "Имя пользователя",
    "role": "operator"
  }
}
```

**Errors:**
- `400 Bad Request` - Refresh токен не предоставлен
- `401 Unauthorized` - Неверный или истекший refresh токен

**Notes:**
- Используется когда `accessToken` истек
- Возвращает новый `accessToken`
- `refreshToken` остается прежним

---

#### 5. Получить информацию о текущем пользователе

```http
GET /accounts/self
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "login": "user@example.com",
  "name": "Имя пользователя",
  "role": "operator"
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден

---

#### 6. Получить список аккаунтов

```http
GET /accounts?page=1&limit=20&search=query
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (опционально): номер страницы (по умолчанию 1)
- `limit` (опционально): количество записей на странице (по умолчанию 20)
- `search` (опционально): поисковый запрос (поиск по login, name, role)

**Response:** `200 OK`
```json
{
  "records": [
    {
      "id": 1,
      "login": "user@example.com",
      "name": "Имя пользователя",
      "role": "operator",
      "is_delete": false,
      "created_at": "2025-11-28T10:00:00.000Z",
      "updated_at": "2025-11-28T10:00:00.000Z"
    }
  ],
  "page": 1,
  "totalPages": 5,
  "totalRecords": 100,
  "recordsPerPage": 20
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден

---

#### 7. Обновить аккаунт

```http
PATCH /accounts/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `id`: ID аккаунта для обновления

**Body:**
```json
{
  "name": "Новое имя",
  "login": "newemail@example.com",
  "password": "newpassword123"
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "login": "newemail@example.com",
  "name": "Новое имя",
  "role": "operator"
}
```

**Validation:**
- Все поля опциональны
- `name`: строка
- `login`: строка (будет нормализован к lowercase)
- `password`: строка (будет захеширован)

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `404 Not Found` - Аккаунт не найден

**Notes:**
- Требуется роль администратора или это должен быть собственный аккаунт пользователя

---

#### 8. Регистрация оператора

```http
POST /accounts/reg
```

**Body:**
```json
{
  "project": "id5678",
  "name": "Имя оператора"
}
```

**Response:** `201 Created`
```json
{
  "message": "Регистрация выполнена успешно",
  "login": "opXyZ123ab",
  "password": "aB3dE5fG7hJ9",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "account": {
    "id": 5,
    "login": "opXyZ123ab",
    "name": "Имя оператора",
    "role": "operator",
    "projectId": 2
  }
}
```

**Validation:**
- `project`: обязательное поле, slug проекта
- `name`: обязательное поле, строка (макс. 256 символов)

**Errors:**
- `404 Not Found` - Проект не найден

**Notes:**
- Автоматически генерирует логин формата `op + 8 случайных символов`
- Автоматически генерирует пароль из 12 случайных символов
- Возвращает логин и пароль для передачи оператору
- Возвращает JWT токены для немедленного использования
- Оператор привязывается к указанному проекту

---

#### 9. Удалить аккаунты

```http
DELETE /accounts
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "ids": [1, 2, 3]
}
```

**Response:** `204 No Content`

**Validation:**
- `ids`: массив числовых ID

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав

**Notes:**
- Только администраторы могут удалять аккаунты
- Выполняется "мягкое" удаление (устанавливается флаг `is_delete = true`)

---

### Projects

#### 1. Создать проект

```http
POST /projects
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "title": "Название мероприятия",
  "slug": "custom-slug",
  "description": "Описание мероприятия",
  "dateStart": "2025-12-10T09:00:00.000Z",
  "dateEnd": "2025-12-12T18:00:00.000Z"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "title": "Название мероприятия",
  "slug": "custom-slug",
  "description": "Описание мероприятия",
  "dateStart": "2025-12-10T09:00:00.000Z",
  "dateEnd": "2025-12-12T18:00:00.000Z"
}
```

**Validation:**
- `title`: обязательное поле, строка (макс. 128 символов)
- `slug`: опционально, строка (макс. 128 символов). Если не указан, генерируется как `id + 4 случайных цифры`
- `description`: опционально, строка (макс. 200 символов)
- `dateStart`: обязательное поле, ISO 8601 дата-время
- `dateEnd`: обязательное поле, ISO 8601 дата-время

**Errors:**
- `400 Bad Request` - Дата окончания раньше даты начала
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)

**Notes:**
- Доступно только администраторам

---

#### 2. Обновить проект

```http
PATCH /projects/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `id`: ID проекта

**Body:**
```json
{
  "title": "Новое название",
  "slug": "new-slug",
  "description": "Новое описание",
  "dateStart": "2025-12-15T09:00:00.000Z",
  "dateEnd": "2025-12-17T18:00:00.000Z"
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "Новое название",
  "slug": "new-slug",
  "description": "Новое описание",
  "dateStart": "2025-12-15T09:00:00.000Z",
  "dateEnd": "2025-12-17T18:00:00.000Z"
}
```

**Validation:**
- Все поля опциональны
- Валидация как при создании

**Errors:**
- `400 Bad Request` - Некорректные даты
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно только администраторам
- При обновлении одной даты проверяется корректность с существующей второй датой

---

#### 3. Получить список проектов

```http
GET /projects?page=1&limit=20&search=query&dateStart=2025-12-01&dateEnd=2025-12-31
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (опционально): номер страницы (по умолчанию 1)
- `limit` (опционально): количество записей на странице (по умолчанию 20)
- `search` (опционально): поисковый запрос по title, description, slug с инвертированной раскладкой (например, "привет" найдет и "ghbdtn")
- `dateStart` (опционально): фильтр по дате начала
- `dateEnd` (опционально): фильтр по дате окончания

**Response:** `200 OK`
```json
{
  "records": [
    {
      "id": 1,
      "title": "Название мероприятия",
      "slug": "id5678",
      "description": "Описание мероприятия",
      "dateStart": "2025-12-10T09:00:00.000Z",
      "dateEnd": "2025-12-12T18:00:00.000Z"
    }
  ],
  "page": 1,
  "totalPages": 3,
  "totalRecords": 45,
  "recordsPerPage": 20
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)

**Notes:**
- Доступно только администраторам
- Фильтр по датам:
  - Если указана только `dateStart` - все события в этот день
  - Если указаны обе даты - события между ними
- Поиск работает с автоматическим переключением раскладки RU↔EN

---

#### 4. Получить проект по slug или ID

```http
GET /projects/:slugOrId
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `slugOrId`: slug или ID проекта

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "Название мероприятия",
  "slug": "id5678",
  "description": "Описание мероприятия",
  "dateStart": "2025-12-10T09:00:00.000Z",
  "dateEnd": "2025-12-12T18:00:00.000Z",
  "scheme": [
    {
      "id": 1,
      "projectId": 1,
      "label": "ФИО",
      "key": "fio",
      "config": {
        "type": "text",
        "uniq": false,
        "maxLength": 256
      }
    },
    {
      "id": 2,
      "projectId": 1,
      "label": "Статус",
      "key": "status",
      "config": {
        "type": "list",
        "uniq": false,
        "listSettings": {
          "multiple": false,
          "items": [
            { "value": "Ожидает", "color": "#FFA500" },
            { "value": "Подтвержден", "color": "#00FF00" }
          ]
        }
      }
    }
  ]
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно всем авторизованным пользователям
- Принимает как числовой ID, так и строковый slug
- Возвращает схему полей проекта в поле `scheme`

---

#### 5. Удалить проект

```http
DELETE /projects/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `id`: ID проекта

**Response:** `204 No Content`

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно только администраторам
- Выполняется "мягкое" удаление (устанавливается флаг `isDelete = true`)

---

#### 6. Получить пользователей проекта

```http
GET /projects/:id/users?page=1&limit=20&search=query
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `id`: ID проекта

**Query Parameters:**
- `page` (опционально): номер страницы (по умолчанию 1)
- `limit` (опционально): количество записей на странице (по умолчанию 20)
- `search` (опционально): поисковый запрос по login и name

**Response:** `200 OK`
```json
{
  "records": [
    {
      "id": 5,
      "login": "opXyZ123ab",
      "name": "Имя оператора",
      "role": "operator",
      "projectId": 1,
      "is_delete": false,
      "created_at": "2025-12-02T10:00:00.000Z",
      "updated_at": "2025-12-02T10:00:00.000Z"
    }
  ],
  "page": 1,
  "totalPages": 2,
  "totalRecords": 35,
  "recordsPerPage": 20
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно только администраторам
- Возвращает всех операторов, привязанных к проекту
- Поддерживает поиск по имени и логину

---

### Project Scheme (Схема полей проекта)

#### 1. Получить схему полей проекта

```http
GET /projects/:projectId/scheme
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта

**Response:** `200 OK`
```json
{
  "fields": [
    {
      "id": 1,
      "projectId": 1,
      "label": "ФИО",
      "key": "fio",
      "config": {
        "type": "text",
        "uniq": false,
        "maxLength": 256
      }
    },
    {
      "id": 2,
      "projectId": 1,
      "label": "Статус участия",
      "key": "status",
      "config": {
        "type": "list",
        "uniq": false,
        "listSettings": {
          "multiple": false,
          "items": [
            { "value": "Ожидает", "color": "#FFA500" },
            { "value": "Подтвержден", "color": "#00FF00" }
          ]
        }
      }
    }
  ]
}
```

**Errors:**
- `400 Bad Request` - Некорректный ID проекта
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно администраторам и операторам своего проекта
- Поля отсортированы по ID

---

#### 2. Добавить поле в схему

```http
POST /projects/:projectId/scheme
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта

**Body:**
```json
{
  "label": "Email",
  "key": "email",
  "config": {
    "type": "text",
    "uniq": true,
    "maxLength": 128
  }
}
```

**Response:** `201 Created`
```json
{
  "id": 3,
  "projectId": 1,
  "label": "Email",
  "key": "email",
  "config": {
    "type": "text",
    "uniq": true,
    "maxLength": 128
  }
}
```

**Field Types:**
| Тип | Описание | Дополнительные настройки |
|-----|----------|-------------------------|
| `text` | Текстовое поле | `maxLength` |
| `list` | Выбор из списка | `listSettings` |
| `bool` | Чекбокс | - |
| `id` | Идентификатор | - |
| `img` | Изображение | - |
| `code` | Код | - |

**Config Structure:**
```json
{
  "type": "text|list|bool|id|img|code",
  "uniq": true|false,
  "maxLength": 256,           // только для text
  "listSettings": {           // только для list
    "multiple": false,
    "items": [
      { "value": "Значение", "color": "#HEX" }
    ]
  }
}
```

**Validation:**
- `label`: обязательное, строка, уникально в рамках проекта
- `key`: обязательное, строка, уникально в рамках проекта
- `config.type`: обязательное, одно из: text, list, bool, id, img, code
- `config.uniq`: обязательное, boolean
- `config.listSettings`: обязательно для type=list

**Errors:**
- `400 Bad Request` - Валидация не пройдена
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно только администраторам

---

#### 3. Обновить поле схемы

```http
PUT /projects/:projectId/scheme/:fieldId
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта
- `fieldId`: ID поля

**Body:**
```json
{
  "config": {
    "type": "list",
    "uniq": false,
    "listSettings": {
      "multiple": true,
      "items": [
        { "value": "VIP", "color": "#FFD700" },
        { "value": "Стандарт", "color": "#C0C0C0" },
        { "value": "Эконом", "color": "#CD7F32" }
      ]
    }
  }
}
```

**Response:** `200 OK`
```json
{
  "id": 2,
  "projectId": 1,
  "label": "Статус участия",
  "key": "status",
  "config": {
    "type": "list",
    "uniq": false,
    "listSettings": {
      "multiple": true,
      "items": [
        { "value": "VIP", "color": "#FFD700" },
        { "value": "Стандарт", "color": "#C0C0C0" },
        { "value": "Эконом", "color": "#CD7F32" }
      ]
    }
  }
}
```

**Validation:**
- Обновление доступно только для полей типа `list`
- Тип поля изменять нельзя
- `config`: обязательное, объект

**Errors:**
- `400 Bad Request` - Поле не типа list или некорректная конфигурация
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект или поле не найдено

**Notes:**
- Доступно только администраторам
- Редактировать можно только поля типа `list` (добавление/удаление вариантов)

---

#### 4. Удалить поле схемы

```http
DELETE /projects/:projectId/scheme/:fieldId
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта
- `fieldId`: ID поля

**Response:** `204 No Content`

**Errors:**
- `400 Bad Request` - Поле не принадлежит проекту
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект или поле не найдено

**Notes:**
- Доступно только администраторам
- Выполняется "мягкое" удаление (устанавливается флаг `is_delete = true`)

---

### Participants (Участники проекта)

#### 1. Получить список участников

```http
GET /projects/:projectId/participants?page=1&limit=20&search=query&order=id&direction=ASC
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта

**Query Parameters:**
- `page` (опционально): номер страницы (по умолчанию 1)
- `limit` (опционально): количество записей на странице (по умолчанию 20, максимум 100)
- `search` (опционально): поисковый запрос (см. раздел "Продвинутый поиск")
- `order` (опционально): поле для сортировки (по умолчанию "id")
- `direction` (опционально): направление сортировки ASC/DESC (по умолчанию "ASC")

**Response:** `200 OK`
```json
{
  "records": [
    {
      "id": 1,
      "projectId": 1,
      "data": {
        "fio": "Иванов Иван Иванович",
        "email": "ivanov@example.com",
        "phone": "+7 (999) 123-45-67",
        "status": "Подтвержден"
      },
      "createdAt": "2026-01-20T10:00:00.000Z",
      "updatedAt": "2026-01-20T10:00:00.000Z"
    }
  ],
  "page": 1,
  "totalPages": 5,
  "totalRecords": 100,
  "recordsPerPage": 20
}
```

**Продвинутый поиск:**

| Синтаксис | Описание | Пример |
|-----------|----------|--------|
| `слово` | Поиск по всем полям | `Иванов` |
| `слово1 слово2` | AND - оба слова должны быть | `Иванов Москва` |
| `слово1 \|\| слово2` | OR - любое из слов | `Иванов \|\| Петров` |
| `{{key: value}}` | Поиск по конкретному полю | `{{status: VIP}}` |
| `Bdfy` | Автоконвертация раскладки → `Иван` | `Bdfy` → найдёт `Иван` |
| `89991234567` | Поиск телефона по цифрам | найдёт `+7 (999) 123-45-67` |
| `Иваноф` | Нечёткий поиск (опечатки) | найдёт `Иванов` |

**Примеры поисковых запросов:**
- `Иванов Москва` - найти где есть И "Иванов" И "Москва"
- `Иванов || Петров` - найти где есть "Иванов" ИЛИ "Петров"
- `{{work: НИИ}} Иванов` - поиск по полю work="НИИ" И везде "Иванов"
- `89991234567` - найти по номеру телефона (игнорируя форматирование)

**Errors:**
- `400 Bad Request` - Некорректный ID проекта
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Оператор не имеет доступа к этому проекту
- `404 Not Found` - Проект не найден

**Notes:**
- Администраторы имеют доступ ко всем проектам
- Операторы имеют доступ только к своему проекту

---

#### 2. Получить участника по ID

```http
GET /projects/:projectId/participants/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта
- `id`: ID участника

**Response:** `200 OK`
```json
{
  "id": 1,
  "projectId": 1,
  "data": {
    "fio": "Иванов Иван Иванович",
    "email": "ivanov@example.com",
    "phone": "+7 (999) 123-45-67",
    "status": "Подтвержден"
  },
  "createdAt": "2026-01-20T10:00:00.000Z",
  "updatedAt": "2026-01-20T10:00:00.000Z"
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Оператор не имеет доступа к этому проекту
- `404 Not Found` - Проект или участник не найден

---

#### 3. Создать участника

```http
POST /projects/:projectId/participants
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта

**Body:**
```json
{
  "data": {
    "fio": "Иванов Иван Иванович",
    "email": "ivanov@example.com",
    "phone": "+7 (999) 123-45-67",
    "status": "Ожидает"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "projectId": 1,
  "data": {
    "fio": "Иванов Иван Иванович",
    "email": "ivanov@example.com",
    "phone": "+7 (999) 123-45-67",
    "status": "Ожидает",
    "participantId": 1
  },
  "createdAt": "2026-01-20T10:00:00.000Z",
  "updatedAt": "2026-01-20T10:00:00.000Z"
}
```

**Validation:**
- `data`: обязательное, объект с данными участника
- Данные валидируются по схеме проекта:
  - Поля типа `id` генерируются автоматически
  - Поля с `uniq: true` проверяются на уникальность
  - Поля типа `list` проверяются на допустимые значения

**Errors:**
- `400 Bad Request` - Валидация не пройдена
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Оператор не имеет доступа к этому проекту
- `404 Not Found` - Проект не найден

**Error Response (validation):**
```json
{
  "errors": {
    "email": "Значение должно быть уникальным",
    "status": "Недопустимое значение для списка"
  }
}
```

---

#### 4. Обновить участника

```http
PATCH /projects/:projectId/participants/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта
- `id`: ID участника

**Body:**
```json
{
  "data": {
    "status": "Подтвержден",
    "phone": "+7 (999) 999-99-99"
  }
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "projectId": 1,
  "data": {
    "fio": "Иванов Иван Иванович",
    "email": "ivanov@example.com",
    "phone": "+7 (999) 999-99-99",
    "status": "Подтвержден",
    "participantId": 1
  },
  "createdAt": "2026-01-20T10:00:00.000Z",
  "updatedAt": "2026-01-20T12:00:00.000Z"
}
```

**Notes:**
- Данные мержатся с существующими (можно передать только изменяемые поля)
- Поля типа `id` не могут быть изменены
- Валидация уникальности исключает текущего участника

**Errors:**
- `400 Bad Request` - Валидация не пройдена
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Оператор не имеет доступа к этому проекту
- `404 Not Found` - Проект или участник не найден

---

#### 5. Удалить участника

```http
DELETE /projects/:projectId/participants/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта
- `id`: ID участника

**Response:** `204 No Content`

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект или участник не найден

**Notes:**
- Доступно только администраторам
- Выполняется "мягкое" удаление (устанавливается флаг `is_delete = true`)

---

#### 6. Отметить печать участника

```http
POST /projects/:projectId/participants/:id/print
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта
- `id`: ID участника

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Print logged"
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Оператор не имеет доступа к этому проекту
- `404 Not Found` - Проект или участник не найден

**Notes:**
- Доступно администраторам и операторам своего проекта
- Создаёт запись в логе с action=PRINT

---

### Participant Logs (Логи действий с участниками)

#### 1. Получить статистику действий

```http
GET /projects/:projectId/participants/log/stats
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта

**Response:** `200 OK`
```json
{
  "CREATE": 150,
  "UPDATE": 320,
  "DELETE": 5,
  "PRINT": 89
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно только администраторам
- Возвращает количество действий каждого типа

---

#### 2. Получить логи действий

```http
GET /projects/:projectId/participants/log?page=1&limit=20&action=CREATE&actor=USER
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта

**Query Parameters:**
- `page` (опционально): номер страницы (по умолчанию 1)
- `limit` (опционально): количество записей на странице (по умолчанию 20, максимум 100)
- `search` (опционально): поиск по данным участника или имени/логину пользователя
- `action` (опционально): фильтр по типу действия (CREATE, UPDATE, DELETE, PRINT)
- `actor` (опционально): фильтр по типу инициатора (USER, WEBHOOK, AUTO)
- `participantId` (опционально): фильтр по ID участника
- `userId` (опционально): фильтр по ID пользователя
- `dateStart` (опционально): начало периода (ISO 8601)
- `dateEnd` (опционально): конец периода (ISO 8601)

**Response:** `200 OK`
```json
{
  "records": [
    {
      "id": 1,
      "projectId": 1,
      "participantId": 5,
      "action": "CREATE",
      "actor": "USER",
      "userId": 2,
      "user": {
        "id": 2,
        "login": "operator@example.com",
        "name": "Оператор 1"
      },
      "currentData": {
        "fio": "Иванов Иван",
        "email": "ivanov@example.com"
      },
      "createdAt": "2026-01-21T10:00:00.000Z"
    }
  ],
  "page": 1,
  "totalPages": 10,
  "totalRecords": 200,
  "recordsPerPage": 20
}
```

**Action Types:**
| Тип | Описание |
|-----|----------|
| `CREATE` | Создание участника |
| `UPDATE` | Обновление данных участника |
| `DELETE` | Удаление участника |
| `PRINT` | Печать бейджа/документа |

**Actor Types:**
| Тип | Описание |
|-----|----------|
| `USER` | Действие выполнено пользователем |
| `WEBHOOK` | Действие выполнено через webhook (в будущем) |
| `AUTO` | Автоматическое действие (в будущем) |

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно только администраторам
- Записи отсортированы по дате (новые первые)
- Включает данные пользователя, выполнившего действие

---

#### 3. Получить логи конкретного участника

```http
GET /projects/:projectId/participants/:participantId/log
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта
- `participantId`: ID участника

**Response:** `200 OK`
```json
{
  "logs": [
    {
      "id": 3,
      "projectId": 1,
      "participantId": 5,
      "action": "UPDATE",
      "actor": "USER",
      "userId": 2,
      "user": {
        "id": 2,
        "login": "operator@example.com",
        "name": "Оператор 1"
      },
      "currentData": {
        "fio": "Иванов Иван",
        "status": "Подтвержден"
      },
      "createdAt": "2026-01-21T12:00:00.000Z"
    },
    {
      "id": 1,
      "projectId": 1,
      "participantId": 5,
      "action": "CREATE",
      "actor": "USER",
      "userId": 2,
      "user": {
        "id": 2,
        "login": "operator@example.com",
        "name": "Оператор 1"
      },
      "currentData": {
        "fio": "Иванов Иван",
        "status": "Ожидает"
      },
      "createdAt": "2026-01-21T10:00:00.000Z"
    }
  ]
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Оператор не имеет доступа к этому проекту
- `404 Not Found` - Проект или участник не найден

**Notes:**
- Доступно администраторам и операторам своего проекта
- Возвращает полную историю изменений участника

---

### Print Templates (Шаблоны печати)

#### 1. Получить все шаблоны

```http
GET /print-templates?search=query
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `search` (опционально): поиск по названию шаблона

**Response:** `200 OK`
```json
{
  "templates": [
    {
      "id": 1,
      "name": "Стандартный бейдж",
      "settings": {
        "width": 90,
        "height": 55,
        "fields": ["name", "company"]
      },
      "preloader": "<svg>...</svg>",
      "createdAt": "2026-01-21T10:00:00.000Z",
      "updatedAt": "2026-01-21T10:00:00.000Z"
    }
  ]
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)

**Notes:**
- Доступно только администраторам

---

#### 2. Получить шаблон по ID

```http
GET /print-templates/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `id`: ID шаблона

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Стандартный бейдж",
  "settings": {
    "width": 90,
    "height": 55,
    "fields": ["name", "company"]
  },
  "preloader": "<svg>...</svg>",
  "createdAt": "2026-01-21T10:00:00.000Z",
  "updatedAt": "2026-01-21T10:00:00.000Z"
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Шаблон не найден

---

#### 3. Создать шаблон

```http
POST /print-templates
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "name": "Стандартный бейдж",
  "settings": {
    "width": 90,
    "height": 55,
    "fields": ["name", "company"]
  },
  "preloader": "<svg>...</svg>"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "Стандартный бейдж",
  "settings": {
    "width": 90,
    "height": 55,
    "fields": ["name", "company"]
  },
  "preloader": "<svg>...</svg>",
  "createdAt": "2026-01-21T10:00:00.000Z",
  "updatedAt": "2026-01-21T10:00:00.000Z"
}
```

**Validation:**
- `name`: обязательное, строка (макс. 1000 символов)
- `settings`: опционально, объект
- `preloader`: опционально, строка

**Errors:**
- `400 Bad Request` - Валидация не пройдена
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)

---

#### 4. Обновить шаблон

```http
PUT /print-templates/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `id`: ID шаблона

**Body:**
```json
{
  "name": "Обновленный шаблон",
  "settings": {
    "width": 100,
    "height": 60
  }
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Обновленный шаблон",
  "settings": {
    "width": 100,
    "height": 60
  },
  "preloader": "<svg>...</svg>",
  "createdAt": "2026-01-21T10:00:00.000Z",
  "updatedAt": "2026-01-21T12:00:00.000Z"
}
```

**Validation:**
- `name`: опционально, строка (макс. 1000 символов)
- `settings`: опционально, объект
- `preloader`: опционально, строка

**Errors:**
- `400 Bad Request` - Валидация не пройдена
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Шаблон не найден

---

#### 5. Удалить шаблон

```http
DELETE /print-templates/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `id`: ID шаблона

**Response:** `204 No Content`

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Шаблон не найден

**Notes:**
- Выполняется "мягкое" удаление

---

### Project Print Template (Шаблон печати проекта)

#### 1. Назначить шаблон проекту

```http
POST /projects/:projectId/print-template
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта

**Body:**
```json
{
  "templateId": 1
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Шаблон назначен проекту",
  "template": {
    "id": 1,
    "name": "Стандартный бейдж",
    "settings": {...},
    "preloader": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Validation:**
- `templateId`: обязательное, положительное число

**Errors:**
- `400 Bad Request` - Валидация не пройдена
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект или шаблон не найден

**Notes:**
- Доступно только администраторам
- Если у проекта уже был шаблон, он заменяется на новый

---

#### 2. Получить шаблон проекта

```http
GET /projects/:projectId/print-template
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта

**Response:** `200 OK`
```json
{
  "template": {
    "id": 1,
    "name": "Стандартный бейдж",
    "settings": {...},
    "preloader": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Response (если шаблон не назначен):**
```json
{
  "template": null
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Оператор не имеет доступа к этому проекту
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно администраторам и операторам своего проекта

---

#### 3. Удалить шаблон у проекта

```http
DELETE /projects/:projectId/print-template
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `projectId`: ID проекта

**Response:** `204 No Content`

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `403 Forbidden` - Недостаточно прав (требуется admin)
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно только администраторам

---

## Error Responses

Все ошибки возвращаются в формате:

```json
{
  "error": "Описание ошибки",
  "code": "#ERROR_CODE" // опционально
}
```

### Коды ошибок

| HTTP Status | Описание |
|------------|----------|
| `400` | Неверный запрос (валидация) |
| `401` | Неавторизован |
| `403` | Доступ запрещен |
| `404` | Ресурс не найден |
| `500` | Внутренняя ошибка сервера |

---

## Роли и права доступа

### Accounts

| Endpoint | admin | operator | public |
|----------|-------|----------|--------|
| `POST /accounts` | ✓ | ✗ | ✗ |
| `POST /accounts/reg` | ✗ | ✗ | ✓ |
| `POST /accounts/auth/operator` | ✓ | ✓ | ✗ |
| `POST /accounts/auth/admin` | ✓ | ✗ | ✗ |
| `POST /accounts/auth/refresh` | ✓ | ✓ | ✗ |
| `GET /accounts/self` | ✓ | ✓ | ✗ |
| `GET /accounts` | ✓ | ✓ | ✗ |
| `PATCH /accounts/:id` | ✓ | ✓ (только свой) | ✗ |
| `DELETE /accounts` | ✓ | ✗ | ✗ |

### Projects

| Endpoint | admin | operator | public |
|----------|-------|----------|--------|
| `POST /projects` | ✓ | ✗ | ✗ |
| `PATCH /projects/:id` | ✓ | ✗ | ✗ |
| `GET /projects` | ✓ | ✗ | ✗ |
| `GET /projects/:slugOrId` | ✓ | ✓ | ✗ |
| `DELETE /projects/:id` | ✓ | ✗ | ✗ |
| `GET /projects/:id/users` | ✓ | ✗ | ✗ |

### Project Scheme

| Endpoint | admin | operator | public |
|----------|-------|----------|--------|
| `GET /projects/:projectId/scheme` | ✓ | ✓ (только свой) | ✗ |
| `POST /projects/:projectId/scheme` | ✓ | ✗ | ✗ |
| `PUT /projects/:projectId/scheme/:fieldId` | ✓ | ✗ | ✗ |
| `DELETE /projects/:projectId/scheme/:fieldId` | ✓ | ✗ | ✗ |

### Participants

| Endpoint | admin | operator | public |
|----------|-------|----------|--------|
| `GET /projects/:projectId/participants` | ✓ | ✓ (только свой) | ✗ |
| `GET /projects/:projectId/participants/:id` | ✓ | ✓ (только свой) | ✗ |
| `POST /projects/:projectId/participants` | ✓ | ✓ (только свой) | ✗ |
| `PATCH /projects/:projectId/participants/:id` | ✓ | ✓ (только свой) | ✗ |
| `DELETE /projects/:projectId/participants/:id` | ✓ | ✗ | ✗ |
| `POST /projects/:projectId/participants/:id/print` | ✓ | ✓ (только свой) | ✗ |
| `GET /projects/:projectId/participants/:id/log` | ✓ | ✓ (только свой) | ✗ |

### Participant Logs

| Endpoint | admin | operator | public |
|----------|-------|----------|--------|
| `GET /projects/:projectId/participants/log/stats` | ✓ | ✗ | ✗ |
| `GET /projects/:projectId/participants/log` | ✓ | ✗ | ✗ |

---

## Authentication Flow

### 1. Регистрация оператора (без токена)

```
POST /accounts/reg
с project slug и name
  ↓
получаем login, password, accessToken, refreshToken
  ↓
сохраняем токены, передаем login/password оператору
```

### 2. Начальная авторизация (существующий пользователь)

```
POST /accounts/auth/operator (или /auth/admin)
с login и password
  ↓
получаем accessToken + refreshToken
  ↓
сохраняем оба токена
```

### 3. Использование API

```
Запрос с Authorization: Bearer <accessToken>
```

### 4. Когда accessToken истек

```
POST /accounts/auth/refresh
с refreshToken
  ↓
получаем новый accessToken
  ↓
продолжаем работу
```

### 5. Когда refreshToken истек

```
Повторная авторизация через
POST /accounts/auth/operator
```

---

## Примеры использования

### JavaScript (fetch)

```javascript
// Регистрация оператора
const registerResponse = await fetch('http://localhost:3000/accounts/reg', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project: 'id5678',
    name: 'Имя Оператора'
  })
});

const { login, password, accessToken, refreshToken, account } = await registerResponse.json();
console.log('Новый оператор:', login, password);

// Авторизация существующего пользователя
const loginResponse = await fetch('http://localhost:3000/accounts/auth/operator', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    login: 'user@example.com',
    password: 'password123'
  })
});

const { accessToken, refreshToken, account } = await loginResponse.json();

// Использование API с токеном
const accountsResponse = await fetch('http://localhost:3000/accounts', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const accounts = await accountsResponse.json();

// Обновление токена
const refreshResponse = await fetch('http://localhost:3000/accounts/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
});

const { accessToken: newAccessToken } = await refreshResponse.json();

// Получить список проектов
const projectsResponse = await fetch('http://localhost:3000/projects?search=форум', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const projects = await projectsResponse.json();

// Создать проект
const createProjectResponse = await fetch('http://localhost:3000/projects', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Dataforum 2025',
    description: 'Ежегодный форум данных',
    dateStart: '2025-12-10T09:00:00.000Z',
    dateEnd: '2025-12-12T18:00:00.000Z'
  })
});

const newProject = await createProjectResponse.json();

// Получить пользователей проекта
const usersResponse = await fetch('http://localhost:3000/projects/1/users', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const projectUsers = await usersResponse.json();
```

### cURL

```bash
# Регистрация оператора
curl -X POST http://localhost:3000/accounts/reg \
  -H "Content-Type: application/json" \
  -d '{"project":"id5678","name":"Имя Оператора"}'

# Авторизация
curl -X POST http://localhost:3000/accounts/auth/operator \
  -H "Content-Type: application/json" \
  -d '{"login":"user@example.com","password":"password123"}'

# Получить список аккаунтов
curl -X GET http://localhost:3000/accounts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Обновить токен
curl -X POST http://localhost:3000/accounts/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'

# Создать проект
curl -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Dataforum 2025","description":"Ежегодный форум","dateStart":"2025-12-10T09:00:00.000Z","dateEnd":"2025-12-12T18:00:00.000Z"}'

# Получить список проектов с поиском
curl -X GET "http://localhost:3000/projects?search=форум&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Получить проект по slug
curl -X GET http://localhost:3000/projects/id5678 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Получить пользователей проекта
curl -X GET http://localhost:3000/projects/1/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Получить схему полей проекта
curl -X GET http://localhost:3000/projects/1/scheme \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Добавить поле в схему
curl -X POST http://localhost:3000/projects/1/scheme \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"Email","key":"email","config":{"type":"text","uniq":true,"maxLength":128}}'

# Обновить поле схемы (только для типа list)
curl -X PUT http://localhost:3000/projects/1/scheme/2 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"config":{"type":"list","uniq":false,"listSettings":{"multiple":false,"items":[{"value":"VIP","color":"#FFD700"}]}}}'

# Удалить поле схемы
curl -X DELETE http://localhost:3000/projects/1/scheme/3 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Получить участников проекта с поиском
curl -X GET "http://localhost:3000/projects/1/participants?search=Иванов&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Поиск участников с OR
curl -X GET "http://localhost:3000/projects/1/participants?search=Иванов%20%7C%7C%20Петров" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Поиск участников по конкретному полю
curl -X GET "http://localhost:3000/projects/1/participants?search=%7B%7Bstatus%3A%20VIP%7D%7D" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Создать участника
curl -X POST http://localhost:3000/projects/1/participants \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"fio":"Иванов Иван","email":"ivanov@example.com","status":"Ожидает"}}'

# Обновить участника
curl -X PATCH http://localhost:3000/projects/1/participants/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"status":"Подтвержден"}}'

# Удалить участника
curl -X DELETE http://localhost:3000/projects/1/participants/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Отметить печать участника
curl -X POST http://localhost:3000/projects/1/participants/1/print \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Получить статистику логов
curl -X GET http://localhost:3000/projects/1/participants/log/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Получить логи проекта
curl -X GET "http://localhost:3000/projects/1/participants/log?action=CREATE&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Получить логи конкретного участника
curl -X GET http://localhost:3000/projects/1/participants/1/log \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Rate Limiting

В текущей версии rate limiting не реализован. Рекомендуется добавить для production.

## CORS

CORS настроен для всех источников (`origin: "*"`). Для production рекомендуется ограничить конкретными доменами.
