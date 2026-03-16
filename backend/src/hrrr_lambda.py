import json
import base64
import urllib.request
import urllib.error
import math
from datetime import datetime, timezone
import s3fs
import xarray as xr
import boto3
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Initialize clients globally to reuse across lambda invocations
s3_client = boto3.client('s3', region_name='us-east-1')
bedrock_client = boto3.client('bedrock-runtime', region_name='us-east-1')

def fetch_open_meteo(lat, lon):
    """
    Fetch current conditions and daily min/max from the free Open-Meteo API.
    """
    url = (
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
        f"&hourly=precipitation_probability,weathercode,temperature_2m"
        f"&daily=temperature_2m_max,temperature_2m_min"
        f"&timezone=auto&forecast_days=1"
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'AWS Lambda Python'})
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            
            # Map new current object to expected dict
            current = data.get('current', {})
            daily = data.get('daily', {})
            hourly = data.get('hourly', {})
            
            # Merge daily min/max into the current weather block
            if daily:
                max_temps = daily.get('temperature_2m_max', [])
                min_temps = daily.get('temperature_2m_min', [])
                if max_temps:
                    current['temperature_max'] = max_temps[0]
                if min_temps:
                    current['temperature_min'] = min_temps[0]
            if hourly:
                current['hourly'] = hourly
            
            return current
    except urllib.error.URLError as e:
        print(f"Open-Meteo fetch failed: {e}")
        return {"error": str(e)}

def fetch_hrrr_and_generate_heatmap(lat, lon):
    """
    Query AWS Open Data for HRRR zarr, extract a 2D slice of wind shear data 
    around the lat/lon (mocked), and generate a heatmap image.
    Returns the path to the saved heatmap image and variables.
    """
    from datetime import timedelta
    fs = s3fs.S3FileSystem(anon=True)
    
    # HRRR AWS Bucket has a 1-2 hour upload delay. Always fetch UTC - 2 hours to avoid Zarr 404s.
    now = datetime.now(timezone.utc) - timedelta(hours=2) 
    date_str = now.strftime('%Y%m%d')
    hour_str = now.strftime('%H')
    
    s3_url = f"s3://hrrrzarr/sfc/{date_str}/{date_str}_{hour_str}z_anl.zarr"
    variables_extracted = {}
    heatmap_path = '/tmp/current_radar.png'
    
    try:
        store = s3fs.S3Map(root=s3_url, s3=fs, check=False)
        ds = xr.open_zarr(store, consolidated=True)
        
        # Mocking nearest grid point logic
        nearest_y_idx, nearest_x_idx = 500, 500 
        
        # 1. Extract variables for raw data response
        for var in ['TMP_surface', 'VWSH_10_to_1000']:
            if var in ds.variables:
                val = ds[var].isel(y=nearest_y_idx, x=nearest_x_idx).values.item()
                variables_extracted[var] = val
                
        # 2. Extract a 2D spatial slice around the coordinates to plot
        # Taking a 50x50 grid around the center point for the heatmap
        y_slice = slice(nearest_y_idx - 25, nearest_y_idx + 25)
        x_slice = slice(nearest_x_idx - 25, nearest_x_idx + 25)
        
        if 'TMP_surface' in ds.variables:
            heat_data = ds['TMP_surface'].isel(y=y_slice, x=x_slice).values
            
            # Generate and save plot
            plt.figure(figsize=(6, 6))
            plt.imshow(heat_data, cmap='inferno', origin='lower')
            plt.colorbar(label='Surface Temperature (Heat Dome)')
            plt.title(f'Surface Temperature Heatmap\nLat: {lat}, Lon: {lon}')
            plt.savefig(heatmap_path, bbox_inches='tight', dpi=100)
            plt.close()
            
            return {
                "s3_path": s3_url,
                "data": variables_extracted,
                "heatmap_generated": True,
                "heatmap_path": heatmap_path
            }

    except Exception as e:
        print(f"HRRR Zarr fetch or plot failed: {e}")
        
    return {"error": "Failed to fetch HRRR data or generate heatmap", "attempted_s3_path": s3_url}

def embed_image(image_path):
    """
    Passes the image to Amazon Nova Multimodal Embed to get its vector representation.
    """
    try:
        with open(image_path, "rb") as image_file:
            input_image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
            
        request_body = json.dumps({
            "inputImage": input_image_base64
        })
        
        print("Embedding current heatmap...")
        response = bedrock_client.invoke_model(
            modelId='amazon.nova-2-multimodal-embeddings-v1:0',
            contentType="application/json",
            accept="application/json",
            body=request_body
        )
        
        response_body = json.loads(response.get('body').read())
        return response_body.get('embedding')
    except Exception as e:
        print(f"Failed to embed image: {e}")
        return None

def cosine_similarity(vec_a, vec_b):
    """
    Calculates the cosine similarity between two numeric vectors.
    Returns a float between -1.0 and 1.0.
    """
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0

    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot_product / (norm_a * norm_b)

def find_closest_historical_match(current_vector):
    """
    Downloads historical_vectors.json from S3, iterates through it to calculate 
    cosine similarities with the current vector, and returns the highest matching impact.
    """
    bucket_name = 'historical-weather-vectors-bucket' # Replace with actual bucket name
    file_key = 'historical_vectors.json'
    local_path = '/tmp/historical_vectors.json'
    
    try:
        # Download historical vectors from S3
        print(f"Downloading {file_key} from {bucket_name}...")
        s3_client.download_file(bucket_name, file_key, local_path)
        
        with open(local_path, 'r') as f:
            historical_data = json.load(f)
            
        highest_similarity = -1.0
        best_match_impact = "Unknown"
        
        for item in historical_data:
            hist_vec = item.get('vector')
            if not hist_vec:
                continue
                
            similarity = cosine_similarity(current_vector, hist_vec)
            if similarity > highest_similarity:
                highest_similarity = similarity
                best_match_impact = item.get('historical_impact', "Unknown")
                
        print(f"Found match with similarity: {highest_similarity:.4f}")
        return {
            "predicted_impact": best_match_impact,
            "confidence_score": highest_similarity
        }
    except Exception as e:
        print(f"Error finding historical match: {e}")
        return {"error": "Failed to compare against historical vectors"}

def lambda_handler(event, context):
    """
    AWS Lambda entry point.
    """
    try:
        if 'body' in event and event['body']:
            body = json.loads(event['body'])
        else:
            body = event
            
        lat = float(body.get('latitude', 40.7128))
        lon = float(body.get('longitude', -74.0060))
    except (TypeError, ValueError):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid latitude or longitude format"})
        }

    # 1. Fetch from Open-Meteo
    open_meteo_data = fetch_open_meteo(lat, lon)
    
    # 2. Fetch HRRR and generate heatmap to /tmp/current_radar.png
    hrrr_data = fetch_hrrr_and_generate_heatmap(lat, lon)
    
    prediction_result = None
    if hrrr_data.get('heatmap_generated'):
        # 3. Embed the generated image using Bedrock Nova Multimodal
        current_vector = embed_image(hrrr_data['heatmap_path'])
        
        # 4. Find closest historical match via vector math
        if current_vector:
            prediction_result = find_closest_historical_match(current_vector)

    # 5. Return combined results
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "coordinates": {"latitude": lat, "longitude": lon},
            "open_meteo": open_meteo_data,
            "hrrr_zarr": hrrr_data.get("data"),
            "historical_prediction": prediction_result
        })
    }
