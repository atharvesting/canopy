import os
import json
import shutil
from unittest.mock import patch

# Import the Lambda functions
import hrrr_lambda
import bedrock_nova

def mock_s3_download(Bucket, Key, Filename):
    print(f"  [Mock] Bypassing S3 download for s3://{Bucket}/{Key}")
    # Instead of downloading, just copy the local file to the target location
    if os.path.exists("historical_vectors.json"):
        shutil.copy("historical_vectors.json", Filename)
    else:
        print("  [Error] historical_vectors.json not found locally!")

def main():
    # Monkeypatch S3 download globally for the local tester
    hrrr_lambda.s3_client.download_file = mock_s3_download
    
    # Hardcoded test payload
    lat = 26.9124
    lon = 75.7873
    inventory_type = 'paper notebooks and unlaminated posters on a folding table'
    
    print("\n--- Project Canopy Local Tester ---")
    
    print(f"\nSTEP 1: Open-Meteo Data Fetch")
    print(f"  Fetching for Lat: {lat}, Lon: {lon}")
    open_meteo_data = hrrr_lambda.fetch_open_meteo(lat, lon)
    print("  " + json.dumps(open_meteo_data, indent=2).replace('\n', '\n  '))
    
    print("\nSTEP 2: Radar Heatmap Generation")
    print("  Querying NOAA HRRR via s3fs & xarray...")
    hrrr_data = hrrr_lambda.fetch_hrrr_and_generate_heatmap(lat, lon)
    
    heatmap_path = "/tmp/current_radar.png"
    if hrrr_data.get('heatmap_generated'):
        heatmap_path = hrrr_data.get('heatmap_path')
        if os.path.exists(heatmap_path):
            print(f"  Success: current_radar.png generated at {heatmap_path}")
        else:
            print(f"  Error: Expected {heatmap_path} but file does not exist.")
            return
    else:
        print("  Failed to generate real heatmap from HRRR data:", hrrr_data.get("error"))
        print("\n  [Mocking Step 2] The NOAA HRRR public dataset has a 1-2 hour processing delay.")
        print("  Because 'current hour' data often 404s, generating a dummy heatmap locally to continue pipeline...")
        
        # Keep pipeline moving by faking the heatmap for bedrock
        import matplotlib.pyplot as plt
        import numpy as np
        os.makedirs("/tmp", exist_ok=True)
        plt.imshow(np.random.rand(50, 50), cmap='viridis')
        plt.title("Simulated Wind Shear")
        plt.savefig(heatmap_path)
        plt.close()
        print(f"  Created dummy radar image at {heatmap_path} to continue pipeline.")
        hrrr_data = {"dummy_fallback": True}
        
    print("\nSTEP 3: Vector Math & Historical Match")
    print("  Embedding the radar image via Amazon Bedrock Nova Multimodal...")
    current_vector = hrrr_lambda.embed_image(heatmap_path)
    
    if not current_vector:
        print("  Error: Could not embed image. Are your AWS credentials configured locally (`aws configure`)?")
        return
        
    print(f"  Success: Extracted {len(current_vector)}-dimensional vector from current_radar.png.")
    
    prediction_result = hrrr_lambda.find_closest_historical_match(current_vector)
    historical_impact = prediction_result.get("predicted_impact", "Unknown context")
    print("  Top matched historical_impact:", historical_impact)
    
    print("\nSTEP 4: Nova 2 Lite Analysis")
    print("  Sending Context + Radar Image + Historical Vector match to Amazon Bedrock Converse API...")
    
    # Provide a generic fallback if Open-Meteo failed
    weather_payload = open_meteo_data if "error" not in open_meteo_data else {"temperature": 85, "conditions": "Sunny"}
    
    assessment = bedrock_nova.assess_vendor_risk(
        weather_data=weather_payload,
        inventory_type=inventory_type,
        historical_impact=historical_impact,
        image_path=heatmap_path
    )
    
    print("\n  Final JSON Warning Generated:")
    print("  " + json.dumps(assessment, indent=2).replace('\n', '\n  '))
    print("\n--- Pipeline Complete ---")

if __name__ == "__main__":
    main()
