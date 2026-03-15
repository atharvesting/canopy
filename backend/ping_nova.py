import boto3

def check_bedrock_access():
    print("Pinging Amazon Nova 2 Lite in us-east-1...")
    
    # Explicitly pin the runtime client to N. Virginia
    client = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    try:
        response = client.converse(
            modelId='amazon.nova-lite-v1:0',
            messages=[{'role': 'user', 'content': [{'text': 'Hello, are you online?'}]}]
        )
        print("\n✅ SUCCESS! AWS Sandbox is lifted. Model says:")
        print(">>", response['output']['message']['content'][0]['text'])
    except Exception as e:
        print(f"\n❌ Still locked in the sandbox. Error: {e}")

if __name__ == "__main__":
    check_bedrock_access()