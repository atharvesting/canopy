from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Union
import uvicorn
import base64
import json
import os
import shutil
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

# Import backend Lambda logic (Bedrock + GIS pipeline — PRESERVED)
import hrrr_lambda
import bedrock_nova

# Import smart fallback modules (activate when Bedrock is unavailable)
import smart_alerts
import vendor_radar

app = FastAPI(title="Project Canopy Local Server")

# Allow Next.js frontend to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Language code → full language name for Bedrock prompt injection
LANGUAGE_MAP = {
    'en': 'English',
    'hi': 'Hindi (Devanagari script)',
    'ta': 'Tamil (Tamil script)',
    'te': 'Telugu (Telugu script)',
    'bn': 'Bengali (Bengali script)',
    'mr': 'Marathi (Devanagari script)',
    'kn': 'Kannada (Kannada script)',
    'gu': 'Gujarati (Gujarati script)',
    'ml': 'Malayalam (Malayalam script)'
}

class AnalyzeRequest(BaseModel):
    latitude: Union[float, int]
    longitude: Union[float, int]
    inventory_type: str
    language: str = 'en'

def mock_s3_download(Bucket, Key, Filename):
    print(f"  [Mock Server] Bypassing S3 download for s3://{Bucket}/{Key}")
    if os.path.exists("historical_vectors.json"):
        shutil.copy("historical_vectors.json", Filename)
    else:
        print("  [Error] historical_vectors.json not found locally!")

# We patch the S3 download globally for the mock server
hrrr_lambda.s3_client.download_file = mock_s3_download

@app.post("/api/analyze")
def analyze_risk(request: AnalyzeRequest):
    print("\n[POST /api/analyze] Received request:")
    print(f"  Lat: {request.latitude}, Lon: {request.longitude}, Inventory: {request.inventory_type}, Lang: {request.language}")
    
    # Resolve language name for Bedrock
    language_name = LANGUAGE_MAP.get(request.language, 'English')
    bedrock_available = True  # Track if Bedrock is reachable
    
    # STEP 1: Fetch Open Meteo (always works — no AWS dependency)
    print("  [STEP 1] Fetching weather conditions from Open-Meteo...")
    open_meteo_data = hrrr_lambda.fetch_open_meteo(request.latitude, request.longitude)
    weather_payload = open_meteo_data if "error" not in open_meteo_data else {"temperature": 30, "windspeed": 10, "weathercode": 0, "is_day": 1}
    
    # STEP 2: Try NOAA HRRR Zarr → Bedrock Embed pipeline
    print("  [STEP 2] Querying NOAA HRRR Zarr dataset...")
    hrrr_data = hrrr_lambda.fetch_hrrr_and_generate_heatmap(request.latitude, request.longitude)
    heatmap_path = "/tmp/current_radar.png"
    
    if hrrr_data.get('heatmap_generated'):
        heatmap_path = hrrr_data.get('heatmap_path')
        print("  ✓ Real HRRR wind shear heatmap generated.")
    else:
        print("  [FALLBACK] HRRR unavailable. Generating vendor-friendly radar from live weather data...")
        heatmap_path = vendor_radar.generate_vendor_radar(
            weather_data=weather_payload,
            lat=request.latitude,
            lon=request.longitude,
            output_path="/tmp/current_radar.png"
        )
        print(f"  ✓ Vendor radar visualization generated at {heatmap_path}")
        
    # STEP 3: Try Bedrock Multimodal Embed → Vector Match pipeline
    print("  [STEP 3] Attempting Bedrock Multimodal Embed for vector matching...")
    current_vector = hrrr_lambda.embed_image(heatmap_path)
    historical_impact = "Unknown context"
    
    if current_vector:
        prediction_result = hrrr_lambda.find_closest_historical_match(current_vector)
        historical_impact = prediction_result.get("predicted_impact", "Unknown context")
        print(f"  ✓ Vector match found: {historical_impact}")
    else:
        bedrock_available = False
        print("  [FALLBACK] Bedrock embed unavailable. Skipping vector pipeline.")
    
    # STEP 4: Try Nova 2 Lite Assessment → Smart Alerts fallback
    print("  [STEP 4] Generating risk assessment...")
    assessment = None
    
    if bedrock_available:
        try:
            print("  Attempting Amazon Nova 2 Lite via Bedrock Converse API...")
            assessment = bedrock_nova.assess_vendor_risk(
                weather_data=weather_payload,
                inventory_type=request.inventory_type,
                historical_impact=historical_impact,
                image_path=heatmap_path,
                language=language_name
            )
            print("  ✓ Nova assessment received.")
        except Exception as e:
            print(f"  [FALLBACK] Nova Converse failed: {e}")
            bedrock_available = False
    
    if not assessment or assessment.get('error'):
        print("  Activating Smart Alerts engine (rule-based, real weather data)...")
        assessment = smart_alerts.generate_alert(
            weather_data=weather_payload,
            inventory_type=request.inventory_type,
            language=request.language
        )
        print(f"  ✓ Smart Alert generated: [{assessment['urgency_level']}]")
    
    # STEP 5: Encode radar image to base64
    radar_base64 = ""
    try:
        with open(heatmap_path, "rb") as image_file:
            radar_base64 = base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        print(f"  Could not encode radar image: {e}")
        
    source = "Amazon Nova (Bedrock)" if bedrock_available else "Smart Alerts (Rule Engine)"
    print(f"  ✓ Pipeline complete. Source: {source}")
    
    return {
        "assessment": assessment,
        "radar_base64": radar_base64,
        "weather_data": open_meteo_data,
        "source": source
    }

if __name__ == "__main__":
    print("Starting Canopy FastApi Mock Server on http://0.0.0.0:8000")
    uvicorn.run("local_server:app", host="0.0.0.0", port=8000, reload=True)
