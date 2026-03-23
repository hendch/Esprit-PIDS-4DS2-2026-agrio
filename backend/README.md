# Agrio Backend

FastAPI backend for the Agrio smart agriculture platform.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate   # Linux / macOS
.venv\Scripts\activate      # Windows

pip install -e ".[dev]"
```

## Running

```bash
uvicorn app.main:app --reload
```

The API docs are available at `http://localhost:8000/docs`.

## Environment

Configuration is read from environment variables prefixed with `AGRIO_` or
from a `.env` file in this directory. See `app/settings.py` for all options.

Key variables:

| Variable | Default | Description |
|---|---|---|
| `AGRIO_DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/agrio` | Async database DSN |
| `AGRIO_JWT_SECRET` | `change-me-in-production` | Secret used to sign JWTs |
| `AGRIO_DEBUG` | `false` | Enable debug mode |

## Tests

```bash
pytest
```
