import { NextResponse } from 'next/server';
import webpush from 'web-push';

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:test@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// We'll store subscriptions in memory for the demo
// In production this would be moved to a DB
const subscriptions = new Set();

export async function POST(request) {
    try {
        const payload = await request.json();
        
        // Handle incoming subscription registration
        if (payload.action === 'subscribe') {
            const { subscription } = payload;
            
            // convert to string and back to enforce standard object
            const stringifiedSub = JSON.stringify(subscription);
            subscriptions.add(stringifiedSub);
            
            console.log("New push subscription registered!");
            
            return NextResponse.json({ 
                success: true, 
                message: 'Subscription fully registered' 
            });
        }
        
        // Trigger a test alert to all subscribed devices
        if (payload.action === 'trigger') {
            const { title, body } = payload;
            
            const notificationPayload = JSON.stringify({
                title: title || 'Project Canopy Alert',
                body: body || 'Extreme Heat Detected: Move all produce to shade immediately.',
                icon: '/icon-192x192.png',
                data: {
                    url: '/'
                }
            });

            console.log(`Sending push to ${subscriptions.size} subscribers...`);
            
            const promises = [];
            for (const stringifiedSub of subscriptions) {
                const sub = JSON.parse(stringifiedSub);
                promises.push(
                    webpush.sendNotification(sub, notificationPayload)
                        .catch(err => {
                            console.error('Failed to send to sub, removing...', err);
                            subscriptions.delete(stringifiedSub);
                        })
                );
            }
            
            await Promise.all(promises);
            
            return NextResponse.json({ 
                success: true, 
                message: `Sent ${promises.length} notifications` 
            });
        }
        
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Push API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}