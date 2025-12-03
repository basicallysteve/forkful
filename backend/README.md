# Todos

## Building Backend Structure
Recommended backend structure looks like this. Would like some flexibility to grow to scale
```
backend/
│
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── v1/
│   │   │   ├── users.py
│   │   │   ├── auth.py
│   │   │   └── items.py
│   │   └── deps.py  # common dependencies (auth, DB session)
│   │
│   ├── core/
│   │   ├── config.py       # env settings
│   │   └── security.py     # JWT / auth utils
│   │
│   ├── db/
│   │   ├── base.py
│   │   ├── session.py      # database connection/session
│   │   └── migrations/     # Alembic migrations
│   │
│   ├── models/
│   │   ├── user.py
│   │   └── item.py
│   │
│   ├── schemas/
│   │   ├── user.py
│   │   └── item.py
│   │
│   ├── services/
│   │   ├── user_service.py
│   │   └── item_service.py
│   │
│   ├── static/             # React build (only in production)
│   ├── utils/              # helper functions shared across modules
│   └── tests/
│       ├── test_users.py
│       └── test_items.py
│
├── .env
├── Pipfile / requirements.txt
└── alembic.ini
```
