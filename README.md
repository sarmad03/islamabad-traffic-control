# Islamabad Smart Traffic Control System

A real-time AI traffic management dashboard for Islamabad, powered by Python + FastAPI backend and a vanilla JS frontend.

## Project Structure

```
islamabad-traffic/
├── backend/
│   ├── server.py           # FastAPI server with WebSocket
│   ├── traffic_manager.py  # Core AI traffic logic (Dijkstra, signals, etc.)
│   └── requirements.txt
└── frontend/
    ├── index.html          # Dashboard UI
    ├── style.css           # Dark-mode styling
    └── app.js              # WebSocket client + UI logic
```

## Setup & Run

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the server

```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
uvicorn server:app --reload --port 8000
```

### 3. Open the app

Visit: **http://localhost:8000**

---

## Features

| Feature | Description |
|---|---|
| **Live Dashboard** | Real-time node table with density, signal state, predictions |
| **AI Route Suggestion** | Dijkstra's algorithm with traffic + accident penalties |
| **Signal Control View** | Visual signal cards per intersection |
| **Route Planner** | Custom point-to-point AI routing |
| **Emergency Mode** | Green wave activation for Faizabad → PIMS |
| **Accident Simulation** | Inject/clear accident at Zero Point → Centaurus |
| **WebSocket** | Live push from server every 1.5 seconds |

## REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/state` | Full system snapshot |
| POST | `/api/route` | Calculate smart route `{start, end}` |
| POST | `/api/emergency/trigger` | Activate emergency green wave |
| POST | `/api/emergency/clear` | Deactivate emergency |
| POST | `/api/accident/trigger` | Simulate accident at Zero Point |
| POST | `/api/accident/clear` | Clear all accidents |
| POST | `/api/simulation/start` | Resume simulation ticks |
| POST | `/api/simulation/stop` | Pause simulation ticks |

## WebSocket

Connect to `ws://localhost:8000/ws` to receive live state pushes every 1.5 seconds.
