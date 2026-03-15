import json
import random

def create_mock():
    data = [
        {
            "filename": "mock_storm_01.png",
            "vector": [float(f"{random.uniform(-1, 1):.4f}") for _ in range(1024)],
            "historical_impact": "Severe canopy damage from 50mph downdraft"
        },
        {
            "filename": "mock_storm_02.png",
            "vector": [float(f"{random.uniform(-1, 1):.4f}") for _ in range(1024)],
            "historical_impact": "Mild rain, manageable with tarps"
        },
        {
            "filename": "mock_storm_03.png",
            "vector": [float(f"{random.uniform(-1, 1):.4f}") for _ in range(1024)],
            "historical_impact": "Extreme flash flooding, inventory washed away"
        }
    ]
    with open("historical_vectors.json", "w") as f:
        json.dump(data, f, indent=2)
    print("Created mock historical_vectors.json with 3 entries.")

if __name__ == "__main__":
    create_mock()
