import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from traffic_manager import TrafficManager
import os

app = FastAPI(title="Islamabad Smart Traffic Control API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")

manager = TrafficManager()
simulation_running = False
connected_clients: list[WebSocket] = []


@app.get("/api/state")
async def get_state():
    return manager.get_state()


class RouteRequest(BaseModel):
    start: str
    end: str


@app.post("/api/route")
async def get_route(req: RouteRequest):
    path, cost = manager.calculate_smart_route(req.start, req.end)
    return {"path": path, "cost": round(cost, 1)}


@app.post("/api/emergency/trigger")
async def trigger_emergency():
    path = manager.trigger_emergency("Faizabad", "PIMS_Hosp")
    manager.optimize_signals()
    await broadcast(manager.get_state())
    return {"status": "triggered", "route": path}


@app.post("/api/emergency/clear")
async def clear_emergency():
    manager.clear_emergency()
    manager.optimize_signals()
    await broadcast(manager.get_state())
    return {"status": "cleared"}


@app.post("/api/accident/trigger")
async def trigger_accident():
    manager.add_accident("Zero_Point", "Centaurus")
    await broadcast(manager.get_state())
    return {"status": "accident added"}


@app.post("/api/accident/clear")
async def clear_accident():
    manager.clear_accidents()
    await broadcast(manager.get_state())
    return {"status": "accidents cleared"}


@app.post("/api/simulation/start")
async def start_simulation():
    global simulation_running
    simulation_running = True
    return {"status": "running"}


@app.post("/api/simulation/stop")
async def stop_simulation():
    global simulation_running
    simulation_running = False
    return {"status": "paused"}


async def broadcast(data: dict):
    dead = []
    for ws in connected_clients:
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            dead.append(ws)
    for ws in dead:
        connected_clients.remove(ws)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    await websocket.send_text(json.dumps(manager.get_state()))
    try:
        while True:
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)


@app.on_event("startup")
async def start_background_loop():
    asyncio.create_task(simulation_loop())


async def simulation_loop():
    global simulation_running
    simulation_running = True
    while True:
        if simulation_running and connected_clients:
            manager.update_world()
            manager.optimize_signals()
            await broadcast(manager.get_state())
        await asyncio.sleep(1.5)


# MUST BE LAST — static mount catches everything
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")