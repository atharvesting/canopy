import boto3

def hunt_for_nova_models():
    print("Connecting to AWS Bedrock in us-east-1...")
    
    try:
        # Force the region to N. Virginia where the newest models live
        bedrock = boto3.client('bedrock', region_name='us-east-1')
        response = bedrock.list_foundation_models()
        
        print("\n--- AVAILABLE NOVA MODELS ---")
        found_nova = False
        for model in response['modelSummaries']:
            # Filter to only show Nova models
            if 'nova' in model['modelId'].lower():
                found_nova = True
                print(f"Name: {model.get('modelName', 'Unknown')}")
                print(f"Exact ID String: '{model['modelId']}'")
                print("-" * 30)
                
        if not found_nova:
            print("No Nova models found in this region for your account.")
            
    except Exception as e:
        print(f"AWS Connection Error: {e}")

if __name__ == "__main__":
    hunt_for_nova_models()