import json
import base64
import glob
import os
import boto3

def generate_embeddings(folder_path: str, output_filepath: str = "historical_vectors.json"):
    """
    Iterates through up to 10 radar PNG images in a local folder, invokes 
    Amazon Bedrock's Nova Multimodal Embed model to get a 1024-dimensional 
    vector, and saves the results to a single JSON file.
    """
    client = boto3.client('bedrock-runtime')
    
    # Model ID as requested by the user
    model_id = 'amazon.nova-embed-multimodal-v1:0'
    historical_impact = "Severe canopy damage from 50mph downdraft"
    results = []

    # Find up to 10 .png files in the specified directory
    png_files = glob.glob(os.path.join(folder_path, "*.png"))
    png_files = png_files[:10]
    
    if not png_files:
        print(f"No PNG files found in {folder_path}")
        return

    for filepath in png_files:
        filename = os.path.basename(filepath)
        
        # Read and base64-encode the image
        try:
            with open(filepath, "rb") as image_file:
                input_image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
        except IOError as e:
            print(f"Could not read {filename}: {e}")
            continue
            
        # The typical schema for multimodal embedding models on Bedrock
        # Note: Depending on the specific release details of Nova Multimodal Embed,
        # the JSON body structure might be similar to Titan Multimodal Embed.
        # This payload assumes an "inputImage" key. It could also potentially 
        # take an "inputText" to jointly embed the visual and text context.
        request_body = json.dumps({
            "inputImage": input_image_base64,
            "inputText": historical_impact # Joint embedding if supported
        })

        try:
            print(f"Generating vector embedding for {filename}...")
            response = client.invoke_model(
                modelId=model_id,
                contentType="application/json",
                accept="application/json",
                body=request_body
            )
            
            response_body = json.loads(response.get('body').read())
            
            # Extract the actual vector embedding array
            # Typically named 'embedding' in Amazon Bedrock APIs
            embedding = response_body.get('embedding')
            
            if embedding:
                results.append({
                    "filename": filename,
                    "vector": embedding, # This should be a 1024 dimensional float array
                    "historical_impact": historical_impact
                })
            else:
                print(f"Warning: No 'embedding' array found in response for {filename}")
                
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    # Write exactly all valid vectors to a JSON file
    try:
        with open(output_filepath, "w") as out_file:
            json.dump(results, out_file, indent=2)
            print(f"Successfully saved {len(results)} vector embeddings to {output_filepath}")
    except IOError as e:
        print(f"Could not save JSON output: {e}")

if __name__ == "__main__":
    # Example local folder of radar images 
    # Create the folder and place 10 .png images inside to test it locally
    example_folder = "historical_radar_data"
    
    if not os.path.exists(example_folder):
        print(f"Please create a directory named '{example_folder}' and add radar .png files to it.")
    else:
        generate_embeddings(example_folder)
