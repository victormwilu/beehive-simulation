from flask import Flask, render_template, jsonify
import random
import math
import os
import time

app = Flask(__name__)

# Default simulation parameters
DEFAULT_SIMULATION_PARAMS = {
    "scout_count": 3,
    "forager_count": 7,
    "papers_found": 8,
    "scout_speed": 4,
    "forager_speed": 2,
    "field_richness": 100,
    "paper_analysis_rate": 1,
    "width": 1000,
    "height": 800
}

# Simulation state
simulation_state = {
    "params": DEFAULT_SIMULATION_PARAMS.copy(),
    "hive": {
        "x": DEFAULT_SIMULATION_PARAMS["width"] // 2,
        "y": DEFAULT_SIMULATION_PARAMS["height"] // 2,
        "radius": 50,
        "papers_analysed": 0
    },
    "queen": {
        "x": DEFAULT_SIMULATION_PARAMS["width"] // 2,
        "y": DEFAULT_SIMULATION_PARAMS["height"] // 2,
        "size": 20
    },
    "scout_bees": [],
    "forager_bees": [],
    "paper_sources": [],
    "papers_found_ids": [],
    "last_update_time": time.time()
}

def reset_simulation(params=None):
    """Reset the simulation with given parameters or defaults"""
    global simulation_state
    
    if params:
        simulation_state["params"] = params
    else:
        simulation_state["params"] = DEFAULT_SIMULATION_PARAMS.copy()
    
    # Update hive and queen positions based on width/height
    simulation_state["hive"]["x"] = simulation_state["params"]["width"] // 2
    simulation_state["hive"]["y"] = simulation_state["params"]["height"] // 2
    simulation_state["queen"]["x"] = simulation_state["hive"]["x"]
    simulation_state["queen"]["y"] = simulation_state["hive"]["y"]
    
    simulation_state["hive"]["papers_analysed"] = 0
    simulation_state["scout_bees"] = []
    simulation_state["forager_bees"] = []
    simulation_state["paper_sources"] = []
    simulation_state["papers_found_ids"] = []
    simulation_state["last_update_time"] = time.time()
    
    # Create paper sources
    for i in range(simulation_state["params"]["papers_found"]):
        paper = {
            "x": random.uniform(100, simulation_state["params"]["width"] - 100),
            "y": random.uniform(100, simulation_state["params"]["height"] - 100),
            "remaining": simulation_state["params"]["field_richness"],
            "original": simulation_state["params"]["field_richness"],
            "discovered": False,
            "id": i
        }
        simulation_state["paper_sources"].append(paper)
    
    # Create scout bees
    for i in range(simulation_state["params"]["scout_count"]):
        scout = {
            "x": simulation_state["hive"]["x"],
            "y": simulation_state["hive"]["y"],
            "target_x": random.uniform(0, simulation_state["params"]["width"]),
            "target_y": random.uniform(0, simulation_state["params"]["height"]),
            "returning": False,
            "papers_found": None,
            "id": i
        }
        simulation_state["scout_bees"].append(scout)
    
    # Create forager bees
    for i in range(simulation_state["params"]["forager_count"]):
        forager = {
            "x": simulation_state["hive"]["x"],
            "y": simulation_state["hive"]["y"],
            "target_x": simulation_state["hive"]["x"],
            "target_y": simulation_state["hive"]["y"],
            "executing": 0,
            "returning": True,
            "paper_found_id": None,
            "id": i
        }
        simulation_state["forager_bees"].append(forager)
    
    return simulation_state

def update_simulation():
    """Update the simulation state by one step"""
    global simulation_state
    
    current_time = time.time()
    elapsed = current_time - simulation_state["last_update_time"]
    
    # Calculate time-based movement factor
    # This ensures consistent movement speed regardless of update frequency
    time_factor = min(elapsed * 5, 1.0)  # Cap at 1.0 to prevent huge jumps
    
    update_scout_bees(time_factor)
    update_forager_bees(time_factor)
    
    simulation_state["last_update_time"] = current_time
    
    return simulation_state

def update_scout_bees(time_factor):
    """Update all scout bees in the simulation"""
    for scout in simulation_state["scout_bees"]:
        if scout["returning"]:
            dx = simulation_state["hive"]["x"] - scout["x"]
            dy = simulation_state["hive"]["y"] - scout["y"]
            d = math.hypot(dx, dy)
            
            if d < simulation_state["hive"]["radius"]:
                if scout["papers_found"] is not None:
                    paper = simulation_state["paper_sources"][scout["papers_found"]]
                    if not paper["discovered"]:
                        paper["discovered"] = True
                        simulation_state["papers_found_ids"].append(scout["papers_found"])
                
                scout["returning"] = False
                scout["papers_found"] = None
                scout["target_x"] = random.uniform(0, simulation_state["params"]["width"])
                scout["target_y"] = random.uniform(0, simulation_state["params"]["height"])
            else:
                # Apply time factor to movement for smoother animation
                move_speed = simulation_state["params"]["scout_speed"] * time_factor
                scout["x"] += (dx / d) * move_speed
                scout["y"] += (dy / d) * move_speed
        else:
            dx = scout["target_x"] - scout["x"]
            dy = scout["target_y"] - scout["y"]
            d = math.hypot(dx, dy)
            
            if d < 5:
                scout["target_x"] = random.uniform(0, simulation_state["params"]["width"])
                scout["target_y"] = random.uniform(0, simulation_state["params"]["height"])
            else:
                # Apply time factor to movement for smoother animation
                move_speed = simulation_state["params"]["scout_speed"] * time_factor
                scout["x"] += (dx / d) * move_speed
                scout["y"] += (dy / d) * move_speed
                
                for paper in simulation_state["paper_sources"]:
                    if paper["remaining"] <= 0:
                        continue
                    
                    dist_to_paper = math.hypot(scout["x"] - paper["x"], scout["y"] - paper["y"])
                    if dist_to_paper < 30:
                        scout["returning"] = True
                        scout["papers_found"] = paper["id"]
                        break

def update_forager_bees(time_factor):
    """Update all forager bees in the simulation"""
    for forager in simulation_state["forager_bees"]:
        if forager["returning"]:
            dx = simulation_state["hive"]["x"] - forager["x"]
            dy = simulation_state["hive"]["y"] - forager["y"]
            d = math.hypot(dx, dy)
            
            if d < simulation_state["hive"]["radius"]:
                simulation_state["hive"]["papers_analysed"] += forager["executing"]
                forager["executing"] = 0
                
                discovered = [paper for paper in simulation_state["paper_sources"] 
                             if paper["discovered"] and paper["remaining"] > 0]
                
                if discovered:
                    target_paper = random.choice(discovered)
                    forager["paper_found_id"] = target_paper["id"]
                    forager["target_x"] = target_paper["x"]
                    forager["target_y"] = target_paper["y"]
                    forager["returning"] = False
            else:
                # Apply time factor to movement for smoother animation
                move_speed = simulation_state["params"]["forager_speed"] * time_factor
                forager["x"] += (dx / d) * move_speed
                forager["y"] += (dy / d) * move_speed
        else:
            if forager["paper_found_id"] is not None:
                target_paper = simulation_state["paper_sources"][forager["paper_found_id"]]
                
                if target_paper["remaining"] <= 0:
                    forager["returning"] = True
                    forager["target_x"] = simulation_state["hive"]["x"]
                    forager["target_y"] = simulation_state["hive"]["y"]
                else:
                    dx = target_paper["x"] - forager["x"]
                    dy = target_paper["y"] - forager["y"]
                    d = math.hypot(dx, dy)
                    
                    if d < 15:
                        # Scale paper analysis rate by time factor
                        amount = min(simulation_state["params"]["paper_analysis_rate"] * time_factor, 
                                    target_paper["remaining"])
                        target_paper["remaining"] -= amount
                        forager["executing"] += amount
                        forager["returning"] = True
                        forager["target_x"] = simulation_state["hive"]["x"]
                        forager["target_y"] = simulation_state["hive"]["y"]
                    else:
                        # Apply time factor to movement for smoother animation
                        move_speed = simulation_state["params"]["forager_speed"] * time_factor
                        forager["x"] += (dx / d) * move_speed
                        forager["y"] += (dy / d) * move_speed
            else:
                forager["returning"] = True
                forager["target_x"] = simulation_state["hive"]["x"]
                forager["target_y"] = simulation_state["hive"]["y"]

def all_papers_analysed():
    """Check if all papers have been completely analysed"""
    return all(paper["remaining"] <= 0 for paper in simulation_state["paper_sources"])

# Initialize the simulation
reset_simulation()

@app.route('/')
def index():
    """Render the main page with the simulation"""
    return render_template('index.html', 
                          simulation_params=simulation_state["params"])

@app.route('/api/simulation/state')
def get_simulation_state():
    """Return the current simulation state as JSON"""
    update_simulation()
    state = {
        "hive": simulation_state["hive"],
        "queen": simulation_state["queen"],
        "scout_bees": simulation_state["scout_bees"],
        "forager_bees": simulation_state["forager_bees"],
        "paper_sources": simulation_state["paper_sources"],
        "papers_found_ids": simulation_state["papers_found_ids"],
        "all_papers_analysed": all_papers_analysed()
    }
    return jsonify(state)

@app.route('/api/simulation/reset', methods=['POST'])
def api_reset_simulation():
    """Reset the simulation"""
    reset_simulation()
    return jsonify({"status": "success"})

@app.route('/api/simulation/update_params/<param>/<float:value>', methods=['POST'])
def update_param(param, value):
    """Update a single simulation parameter"""
    if param in simulation_state["params"]:
        simulation_state["params"][param] = value
        return jsonify({"status": "success", "param": param, "value": value})
    return jsonify({"status": "error", "message": f"Unknown parameter: {param}"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
