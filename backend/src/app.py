import json
import os
import uuid
import boto3
from botocore.exceptions import ClientError

# Initialize the DynamoDB client
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'SubscriptionsTable')
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    """
    AWS Lambda handler to receive a Web Push subscription object and geolocation
    and save it into DynamoDB.
    """
    # Create default response headers for CORS
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,POST"
    }

    try:
        # Check for HTTP method (handle OPTIONS for CORS preflight if needed)
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': ''
            }

        # Parse the JSON payload from the request body
        if 'body' not in event or not event['body']:
            raise ValueError("Empty request body")
            
        body = json.loads(event['body'])
        
        # Extract required fields
        latitude = body.get('latitude')
        longitude = body.get('longitude')
        inventory_type = body.get('inventory_type')
        subscription = body.get('subscription')
        
        if not all([latitude, longitude, inventory_type, subscription]):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Missing required fields (latitude, longitude, inventory_type, subscription)'})
            }

        # Generate a unique ID for the record
        record_id = str(uuid.uuid4())
        
        # Construct the item to insert
        item = {
            'id': record_id,
            'latitude': str(latitude),
            'longitude': str(longitude),
            'inventory_type': inventory_type,
            'subscription': subscription
        }
        
        # Save to DynamoDB
        table.put_item(Item=item)
        
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({
                'message': 'Subscription saved successfully',
                'id': record_id
            })
        }
        
    except ValueError as ve:
        print(f"Validation Error: {str(ve)}")
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': str(ve)})
        }
    except ClientError as ce:
        print(f"DynamoDB Error: {str(ce)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error while accessing database'})
        }
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'An unexpected error occurred'})
        }
