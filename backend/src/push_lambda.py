import json
import os
import boto3
from botocore.exceptions import ClientError
from pywebpush import webpush, WebPushException

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'SubscriptionsTable')
table = dynamodb.Table(table_name)

# VAPID keys should be stored securely (e.g., AWS Secrets Manager or Systems Manager Parameter Store)
# For demonstration, we assume they are passed as environment variables
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY')
VAPID_CLAIM_EMAIL = os.environ.get('VAPID_CLAIM_EMAIL', 'mailto:admin@example.com')

def lambda_handler(event, context):
    """
    AWS Lambda handler to fetch user subscriptions from DynamoDB
    and send them a JSON alert via Web Push.
    """
    try:
        # Assuming the alert payload is passed in the event
        # E.g. {"urgency_level": "HIGH", "mitigation_alert": "Secure your fresh produce..."}
        alert_payload = event.get('alert', {})
        
        if not alert_payload:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No alert payload provided'})
            }

        push_message = json.dumps({
            "title": f"Risk Alert: {alert_payload.get('urgency_level', 'UPDATE')}",
            "body": alert_payload.get('mitigation_alert', 'Check your dashboard for updates.'),
            "url": "/"
        })

        # Fetch subscriptions from DynamoDB
        # In a real scenario, you might query specific users based on location or ID
        response = table.scan()
        items = response.get('Items', [])
        
        success_count = 0
        failure_count = 0

        for item in items:
            subscription = item.get('subscription')
            
            if not subscription:
                continue
                
            try:
                webpush(
                    subscription_info=subscription,
                    data=push_message,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_CLAIM_EMAIL}
                )
                success_count += 1
            except WebPushException as ex:
                print(f"Web Push failed for ID {item.get('id')}: {repr(ex)}")
                # If the subscription is expired or invalid (e.g. 410 Gone), you should delete it from DynamoDB
                if ex.response and ex.response.status_code in [404, 410]:
                    print(f"Removing invalid subscription {item.get('id')}")
                    table.delete_item(Key={'id': item.get('id')})
                failure_count += 1
                
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Push notifications processed',
                'success': success_count,
                'failures': failure_count
            })
        }

    except ClientError as ce:
        print(f"DynamoDB Error: {str(ce)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Database access error'})
        }
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
