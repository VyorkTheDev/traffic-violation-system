# Traffic Violation Detection System

A full-stack web application for managing traffic violations with AI-powered image analysis. Police officers can upload violation photos, and the system automatically detects violations (phone use, smoking, no seatbelt) using Claude Vision AI.

## Tech Stack

- **Backend**: Flask (Python), PostgreSQL, SQLAlchemy, JWT, bcrypt
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts
- **AI**: Anthropic Claude Vision API (`claude-sonnet-4-6`)

## Project Structure

```
traffic-violation-system/
├── backend/
│   ├── routes/
│   │   ├── auth.py          # POST /api/auth/register, /login
│   │   ├── vehicles.py      # CRUD /api/vehicles/
│   │   ├── violations.py    # CRUD /api/violations/ (multipart upload)
│   │   ├── police.py        # /api/police/violations, /search
│   │   └── admin.py         # Full CRUD + stats /api/admin/
│   ├── app.py               # Flask factory, CORS, blueprints
│   ├── models.py            # User, Vehicle, Violation (SQLAlchemy)
│   ├── config.py            # Env-based configuration
│   ├── middleware.py        # token_required, role_required decorators
│   ├── ai_service.py        # Async Claude Vision analysis
│   ├── utils.py             # ok() / err() response helpers
│   ├── seed.py              # Seeds admin user
│   ├── test_backend.py      # 24 integration tests
│   └── .env                 # Secrets (not committed)
└── frontend/
    ├── src/
    │   ├── services/api.js  # Axios instance + all API calls
    │   ├── App.jsx          # Router + ProtectedRoute
    │   └── pages/
    │       ├── Login.jsx
    │       ├── Register.jsx
    │       ├── CitizenDashboard.jsx
    │       ├── PoliceDashboard.jsx
    │       └── AdminPanel.jsx
    └── vite.config.js
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env            # then fill in your values
```

**.env file:**
```
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://postgres:admin123@localhost:5432/traffic_db
ANTHROPIC_API_KEY=sk-ant-...
UPLOAD_FOLDER=uploads
DEBUG=True
```

```bash
# Seed the database (creates admin user)
python seed.py

# Run the backend
python app.py
# Backend runs on http://localhost:5000
```

### Frontend

```bash
cd frontend

npm install

# Optional: create .env.local to override API URL
# VITE_API_URL=http://localhost:5000

npm run dev
# Frontend runs on http://localhost:3000
```

## Default Credentials

| Role    | Username | Password  |
|---------|----------|-----------|
| Admin   | admin    | admin123  |

Additional accounts can be created via:
- `/register` — self-registration (citizen role)
- Admin Panel → Users → Add User (any role)

## User Roles

| Role    | Capabilities |
|---------|-------------|
| **citizen** | View own vehicles and their violations |
| **police**  | Report violations (photo upload), manage own reports, search by plate |
| **admin**   | Full access: manage all users, vehicles, violations; view analytics dashboard |

## API Reference

### Auth
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/auth/register` | `{username, email, password}` | None |
| POST | `/api/auth/login` | `{username, password}` | None |

### Vehicles
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/vehicles/` | citizen+ |
| POST | `/api/vehicles/` | citizen+ |
| GET | `/api/vehicles/:id` | citizen+ |
| DELETE | `/api/vehicles/:id` | citizen+ |

### Violations
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/violations/` | Police/admin see all; citizen sees own |
| GET | `/api/violations/:id` | Ownership enforced for citizens |
| POST | `/api/violations/` | Police only; multipart/form-data |
| PUT | `/api/violations/:id` | Creator or admin only |
| DELETE | `/api/violations/:id` | Creator or admin only |

**POST `/api/violations/` form fields:** `photo` (file), `plate`, `location`, `speed` (optional)

### Police
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/police/violations` | Own violations only |
| GET | `/api/police/search?plate=XX` | Partial plate match |

### Admin
| Method | Endpoint |
|--------|----------|
| GET/POST | `/api/admin/users` |
| DELETE | `/api/admin/users/:id` |
| PUT | `/api/admin/users/:id/role` |
| GET/POST | `/api/admin/vehicles` |
| DELETE | `/api/admin/vehicles/:id` |
| GET | `/api/admin/violations` |
| GET | `/api/admin/violations/:id` |
| DELETE | `/api/admin/violations/:id` |
| GET | `/api/admin/stats` |

### Response Format

All endpoints return:
```json
{
  "success": true,
  "data": {...},
  "message": "..."
}
```

Errors:
```json
{
  "success": false,
  "message": "Error description"
}
```

## AI Analysis

When a violation is created, the backend spawns a background thread that:
1. Reads the uploaded photo
2. Sends it to Claude Vision API (`claude-sonnet-4-6`) with a structured prompt
3. Detects: phone use, smoking, no seatbelt
4. Updates `violation_type` JSON and `ai_status` (`pending` → `completed` / `failed`)

## Running Tests

```bash
cd backend
python test_backend.py
```

Requires a running PostgreSQL instance with the credentials in `.env`. The test suite creates and cleans up its own test data.

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing secret | — (required) |
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `ANTHROPIC_API_KEY` | Claude API key | — (required for AI) |
| `UPLOAD_FOLDER` | Photo storage directory | `uploads` |
| `DEBUG` | Flask debug mode | `False` |
| `VITE_API_URL` | Backend URL for frontend | `http://localhost:5000` |
