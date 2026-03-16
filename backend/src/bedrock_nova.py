import json
import boto3
from botocore.exceptions import ClientError

def assess_vendor_risk(weather_data: dict, inventory_type: str, historical_impact: str, image_path: str = "/tmp/current_radar.png", language: str = "English") -> dict:
    """
    Invokes Amazon Nova 2 Lite via the Bedrock Converse API to act as a 
    localized risk assessor for a street vendor, given their inventory 
    and current weather conditions.
    """
    # Initialize the Bedrock Runtime client
    client = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    # Model ID for Amazon Nova 2 Lite
    model_id = 'amazon.nova-2-lite-v1:0'
    
    # Build language instruction
    language_instruction = ""
    if language and language != "English":
        language_instruction = f" You MUST respond entirely in {language}. Use the native script for that language (e.g., Devanagari for Hindi, Tamil script for Tamil, etc). The JSON keys ('urgency_level' and 'mitigation_alert') must remain in English, but ALL values must be in {language}."
    
    # Define the system prompt instructing the model on its persona and output format
    system_prompts = [
        {
            "text": (
                "You are an expert localized risk assessor for street vendors in India, helping them survive extreme weather. "
                "Analyze the provided heat/weather radar image and current data. Compare it to the historical weather context provided to determine the risk to the user's specific inventory. "
                "Give grounded, street-smart, practical advice. Avoid apocalyptic or over-dramatic tones—these vendors have hard experience. Instead of 'seek shelter immediately', suggest things like 'cover leafy greens with damp gunny sacks', 'keep electronics out of direct sun to prevent battery melt', or 'reduce bulk orders due to heat spoilage'. "
                "Output a strict JSON response. The JSON must contain exactly two keys: 'urgency_level' (String: LOW, MEDIUM, or HIGH) "
                "and 'mitigation_alert' (String: exactly 2 sentences of actionable, realistic advice to protect their specific inventory)."
                + language_instruction
            )
        }
    ]
    
    # Read the radar image from the local filesystem
    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
    except IOError as e:
        print(f"Could not read image {image_path}: {e}")
        image_bytes = b""
        
    content_blocks = [
        {
            "text": f"Inventory Type: {inventory_type}\nCurrent Weather Conditions: {json.dumps(weather_data)}"
        },
        {
            "text": f"Historical Storm Context: {historical_impact}"
        }
    ]
    
    if image_bytes:
        content_blocks.append({
            "image": {
                "format": "png",
                "source": {
                    "bytes": image_bytes
                }
            }
        })
        
    messages = [
        {
            "role": "user",
            "content": content_blocks
        }
    ]
    
    try:
        # Use the Converse API to send the request
        response = client.converse(
            modelId=model_id,
            messages=messages,
            system=system_prompts,
            # Enabling extended thinking (if supported by Nova via additional fields)
            # as it varies by model family. This injects it into the model-specific request fields.
            additionalModelRequestFields={
                "extended_thinking": {
                    "enabled": True
                }
            },
            # We can also restrict the output format to JSON if the model natively supports JSON mode
            # For strict JSON, we also prompt it strongly in the system prompt.
            toolConfig={
                "tools": [],
                # Some models might require specific config to return JSON, 
                # but strong system prompts usually suffice for Converse API.
            }
        )
        
        # Extract the text response
        response_text = response['output']['message']['content'][0]['text']
        
        # Parse the JSON
        # Note: Depending on the model, it might wrap JSON in Markdown blocks (```json ... ```)
        # So we strip those if present before parsing.
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]
            
        result_json = json.loads(cleaned_text.strip())
        return result_json

    except ClientError as e:
        print(f"Bedrock ClientError: {e}")
        return {"error": str(e)}
    except json.JSONDecodeError as e:
        print(f"Failed to parse model response as JSON: {response_text}")
        return {"error": "Invalid JSON response from model"}
    except Exception as e:
        print(f"Unexpected error: {e}")
        return {"error": str(e)}


# Example usage:
if __name__ == "__main__":
    sample_weather = {
        "temperature": 92,
        "wind_speed": 15,
        "precipitation_probability": 80,
        "conditions": "Approaching Thunderstorm"
    }
    sample_inventory = "Fresh Produce and Cut Fruit"
    
    print("Evaluating risk...")
    historical_impact_sample = "Severe canopy damage from 50mph downdraft"
    assessment = assess_vendor_risk(sample_weather, sample_inventory, historical_impact_sample)
    print(json.dumps(assessment, indent=2))
