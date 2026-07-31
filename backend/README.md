# OnCall Foot — Backend

FastAPI + MongoDB + JWT (httpOnly cookies). All routes are prefixed with `/api`.
Supervisor loads `server:app`, which is a thin re-export of `app.main:app`.

## Layout

```
backend/
├── server.py                 # thin re-export of app.main:app (compat entrypoint)
├── app/
│   ├── main.py               # FastAPI factory, /api mount, startup indexes
│   ├── core/
│   │   ├── config.py         # env / settings
│   │   ├── security.py       # bcrypt, JWT, cookies
│   │   ├── permissions.py    # Role + Permission enums, RBAC helpers, require_permission()
│   │   ├── dependencies.py   # get_current_user, get_client_ip
│   │   └── constants.py      # Collections + status enums
│   ├── db/mongo.py           # Motor client singleton
│   ├── models/               # Pydantic request/response models
│   │   ├── auth.py           # RegisterInput, LoginInput
│   │   ├── user.py           # UserOut + user_to_out()
│   │   ├── provider.py       # OnboardingInput
│   │   ├── service.py        # ServiceCreate / Update / Out
│   │   └── common.py         # PyObjectId
│   ├── repositories/         # Raw Mongo access — no business logic
│   │   ├── user_repository.py
│   │   ├── login_attempt_repository.py
│   │   └── service_repository.py
│   ├── services/             # Business logic — orchestrates repos, raises HTTPException
│   │   ├── auth_service.py
│   │   ├── lockout_service.py
│   │   ├── provider_service.py
│   │   └── catalog_service.py    # provider service catalog (Checkpoint 2)
│   └── routers/              # Thin FastAPI routers — parse, delegate, shape
│       ├── health.py
│       ├── auth.py
│       ├── providers.py
│       ├── services.py       # /api/services CRUD + toggle
│       └── dashboard.py      # /api/dashboard/provider-summary
└── tests/
    └── test_auth.py
```

## Migration map (old `server.py` → new files)

| Old (server.py) | New location |
| --- | --- |
| `PyObjectId` | `app/models/common.py` |
| `UserOut`, `user_to_out()` | `app/models/user.py` |
| `RegisterInput`, `LoginInput` | `app/models/auth.py` |
| `OnboardingInput` | `app/models/provider.py` |
| `hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`, `set_auth_cookies` | `app/core/security.py` |
| `get_current_user` | `app/core/dependencies.py` |
| `check_lockout`, `record_failure` | `app/services/lockout_service.py` |
| `POST /api/auth/register` | `app/routers/auth.py` → `app/services/auth_service.py` |
| `POST /api/auth/login` | same |
| `POST /api/auth/logout` | same |
| `POST /api/auth/refresh` | same |
| `GET /api/auth/me` | same |
| `PUT /api/providers/me` | `app/routers/providers.py` → `app/services/provider_service.py` |
| Startup index creation | `app/main.py` |

## Adding a new endpoint

1. Add Pydantic model → `app/models/<domain>.py`
2. Add raw DB access → `app/repositories/<domain>_repository.py` (add `ensure_indexes()` if needed)
3. Add business logic → `app/services/<domain>_service.py`
4. Add router → `app/routers/<domain>.py`
5. Register router in `app/main.py`
6. Gate with `require_permission(Permission.X)` from `app/core/permissions.py`

## Authorization

- **RBAC** is centralized in `app/core/permissions.py`: `Role`, `Permission`, `ROLE_PERMISSIONS`, `require_permission(...)`, `require_any_permission(...)`.
- **Ownership** (e.g. "this provider owns this service") lives in the service/repository layer via `provider_id` filters — not in `permissions.py`.
- Only the `provider` role is exercised today. `client` and `admin` roles are scaffolded so future routers can be gated without changing the auth model.

## Env

`backend/.env`

```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=*
JWT_SECRET=<long random hex>
```

## Tests

```
cd /app/backend && python -m pytest tests/ -v
```
