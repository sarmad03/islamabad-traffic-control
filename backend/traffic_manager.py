import random
import heapq
from collections import deque


NODES = [
    "Faisal_Mosque", "Blue_Area", "Zero_Point",
    "Srinagar_Hwy", "Centaurus", "Faizabad", "PIMS_Hosp"
]

ROADS = [
    ("Faisal_Mosque", "Blue_Area", 4),
    ("Blue_Area", "Centaurus", 2),
    ("Centaurus", "PIMS_Hosp", 3),
    ("Blue_Area", "PIMS_Hosp", 4),
    ("Faisal_Mosque", "Srinagar_Hwy", 6),
    ("Srinagar_Hwy", "Zero_Point", 5),
    ("Zero_Point", "Centaurus", 4),
    ("Zero_Point", "Faizabad", 8),
    ("PIMS_Hosp", "Faizabad", 6),
    ("Srinagar_Hwy", "Faizabad", 12)
]


class TrafficManager:
    def __init__(self):
        self.density = {node: random.randint(15, 35) for node in NODES}
        self.signals = {node: "RED" for node in NODES}
        self.green_times = {node: 20 for node in NODES}
        self.accidents = []
        self.emergency_route = []
        self.history = {node: deque(maxlen=5) for node in NODES}
        self.step = 0

        self.graph = {node: {} for node in NODES}
        for u, v, w in ROADS:
            self.graph[u][v] = w
            self.graph[v][u] = w

    def optimize_signals(self):
        for node in NODES:
            if node in self.emergency_route:
                self.signals[node] = "GREEN"
                self.green_times[node] = 99
            else:
                d = self.density[node]
                if d > 80:
                    self.green_times[node] = 60
                    self.signals[node] = "GREEN"
                elif d > 45:
                    self.green_times[node] = 40
                    self.signals[node] = "GREEN" if random.random() > 0.4 else "RED"
                else:
                    self.green_times[node] = 20
                    self.signals[node] = "RED"

    def get_congested_zones(self):
        return [n for n, d in self.density.items() if d > 75]

    def calculate_smart_route(self, start, end):
        queue = [(0, start, [])]
        visited = set()
        while queue:
            (cost, current_node, path) = heapq.heappop(queue)
            if current_node in visited:
                continue
            path = path + [current_node]
            visited.add(current_node)
            if current_node == end:
                return path, cost
            for neighbor, distance in self.graph[current_node].items():
                accident_penalty = 2000 if (
                    (current_node, neighbor) in self.accidents or
                    (neighbor, current_node) in self.accidents
                ) else 0
                traffic_delay = self.density[neighbor] * 0.25
                total_weight = distance + traffic_delay + accident_penalty
                heapq.heappush(queue, (cost + total_weight, neighbor, path))
        return [], 0

    def predict_density(self, node):
        h = self.history[node]
        if len(h) < 2:
            return "STABLE"
        avg = sum(h) / len(h)
        last = h[-1]
        if last > avg + 12:
            return "RISING"
        if last < avg - 12:
            return "IMPROVING"
        return "STABLE"

    def trigger_emergency(self, origin="Faizabad", destination="PIMS_Hosp"):
        path, _ = self.calculate_smart_route(origin, destination)
        self.emergency_route = path
        return path

    def clear_emergency(self):
        self.emergency_route = []

    def add_accident(self, u="Zero_Point", v="Centaurus"):
        pair = (u, v)
        if pair not in self.accidents:
            self.accidents.append(pair)

    def clear_accidents(self):
        self.accidents = []

    def update_world(self):
        self.step += 1
        for node in NODES:
            change = random.randint(-18, 22)
            self.density[node] = max(5, min(100, self.density[node] + change))
            self.history[node].append(self.density[node])

        if random.random() < 0.1 and not self.accidents:
            self.accidents.append(("Zero_Point", "Centaurus"))
        elif random.random() > 0.7:
            self.accidents = []

    def get_state(self):
        alt_path, alt_cost = self.calculate_smart_route("Faizabad", "Faisal_Mosque")
        nodes_data = []
        for n in NODES:
            nodes_data.append({
                "name": n,
                "density": self.density[n],
                "signal": self.signals[n],
                "green_time": self.green_times[n],
                "prediction": self.predict_density(n),
                "in_emergency_route": n in self.emergency_route,
                "has_accident": any(n in pair for pair in self.accidents),
            })

        return {
            "step": self.step,
            "nodes": nodes_data,
            "accidents": [list(a) for a in self.accidents],
            "emergency_route": self.emergency_route,
            "congested_zones": self.get_congested_zones(),
            "suggested_route": {
                "path": alt_path,
                "cost": round(alt_cost, 1),
            },
            "stats": {
                "avg_density": round(sum(self.density.values()) / len(NODES), 1),
                "green_count": sum(1 for s in self.signals.values() if s == "GREEN"),
                "accident_count": len(self.accidents),
                "congestion_count": len(self.get_congested_zones()),
            }
        }

