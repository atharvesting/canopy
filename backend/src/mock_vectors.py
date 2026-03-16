import json
import random

def create_mock():
    data = [
        {
            "filename": "mock_heatwave_delhi.png",
            "vector": [float(f"{random.uniform(-1, 1):.4f}") for _ in range(1024)],
            "historical_impact": "IMD_HW_2022_NW: April 2022 Northwest India Heatwave. Prolonged dry heat dome. Electronic goods and plastic wares exposed to direct sunlight suffered melting and battery degradation. Fruit vendors saw 60% daily stock spoilage. Mitigation: Covered displays with double-layered reflective tarps."
        },
        {
            "filename": "mock_heatwave_ap.png",
            "vector": [float(f"{random.uniform(-1, 1):.4f}") for _ in range(1024)],
            "historical_impact": "IMD_HW_2015_AP_TS: 2015 Indian heatwave in Andhra Pradesh and Telangana. Severe urban heat island effect. Major loss of fresh produce for street vendors within 4 hours of sunrise. Mitigation: Shifted operating hours to early morning (5AM - 9AM) and late evening. Mandated heavy use of jute bags soaked in water for root vegetables."
        },
        {
            "filename": "mock_humid_heat_up.png",
            "vector": [float(f"{random.uniform(-1, 1):.4f}") for _ in range(1024)],
            "historical_impact": "IMD_HW_2023_UP_BIHAR: June 2023 UP/Bihar Humid Heatwave. Deadly 'wet-bulb' conditions. Extreme humidity accelerated fungal and bacterial rot on open-air cut fruits and meat within 2 hours. Mitigation: Halted sale of pre-cut fruits entirely. Relied strictly on whole-fruit sales and block-ice chilling."
        }
    ]
    with open("historical_vectors.json", "w") as f:
        json.dump(data, f, indent=2)
    print("Created structured, Indian-heatwave focused historical_vectors.json with 3 entries.")

if __name__ == "__main__":
    create_mock()
