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
  "dateEnd": "2025-12-12T18:00:00.000Z"
}
```

**Errors:**
- `401 Unauthorized` - Токен не предоставлен или невалиден
- `404 Not Found` - Проект не найден

**Notes:**
- Доступно всем авторизованным пользователям
- Принимает как числовой ID, так и строковый slug

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
```

---

## Rate Limiting

В текущей версии rate limiting не реализован. Рекомендуется добавить для production.

## CORS

CORS настроен для всех источников (`origin: "*"`). Для production рекомендуется ограничить конкретными доменами.
