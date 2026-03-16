import { NextResponse } from 'next/server';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

const explicitServerPublicKey = process.env.VAPID_PUBLIC_KEY;
const clientExposedPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const publicKeysMatch =
    !explicitServerPublicKey ||
    !clientExposedPublicKey ||
    explicitServerPublicKey === clientExposedPublicKey;

const vapidPublicKey = explicitServerPublicKey || clientExposedPublicKey;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:test@example.com';

let vapidConfigured = false;
let vapidConfigError = null;

if (!publicKeysMatch) {
    vapidConfigError = 'VAPID public key mismatch between VAPID_PUBLIC_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY';
    console.warn('VAPID public key mismatch between server and client env vars. Push notifications are disabled until keys match.');
} else if (vapidPublicKey && vapidPrivateKey) {
    try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        vapidConfigured = true;
    } catch (e) {
        vapidConfigError = e.message;
        console.warn('Failed to set VAPID details:', e.message);
    }
} else {
    vapidConfigError = 'Missing VAPID keys';
    console.warn('VAPID keys are missing. Push notifications will be disabled. Set VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY) and VAPID_PRIVATE_KEY in Vercel.');
}

const keyFingerprint = (key) => {
    if (!key || key.length < 12) return 'missing';
    return `${key.slice(0, 6)}...${key.slice(-6)}`;
};

const pushDiagnostics = () => ({
    vapidConfigured,
    vapidConfigError,
    publicKeysMatch,
    hasPublicKey: Boolean(vapidPublicKey),
    hasVapidPublicKeyEnv: Boolean(explicitServerPublicKey),
    hasNextPublicVapidEnv: Boolean(clientExposedPublicKey),
    hasPrivateKey: Boolean(vapidPrivateKey),
    publicKeyFingerprint: keyFingerprint(vapidPublicKey),
    privateKeyFingerprint: keyFingerprint(vapidPrivateKey),
    subject: vapidSubject
});

// We'll store subscriptions in memory for the demo
// In production this would be moved to a DB
const subscriptions = new Set();

export async function GET() {
    return NextResponse.json({
        ok: true,
        diagnostics: pushDiagnostics()
    });
}

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
                message: 'Subscription fully registered',
                diagnostics: pushDiagnostics()
            });
        }
        
        // Trigger a test alert to all subscribed devices
        if (payload.action === 'trigger') {
            const { title, body, subscription, language } = payload;

            if (!vapidConfigured) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Push server is not configured with valid VAPID credentials.',
                        diagnostics: pushDiagnostics()
                    },
                    { status: 503 }
                );
            }

            const notificationPayload = JSON.stringify({
                title: title || 'Project Canopy Alert',
                body: body || 'Extreme Heat Detected: Move all produce to shade immediately.',
                language: language || 'en',
                data: { url: '/', language: language || 'en' }
            });

            // If the client provided their subscription directly in the trigger request,
            // we send to it immediately (bypassing the need for in-memory persistence on serverless)
            if (subscription) {
                console.log("Sending push directly to provided subscription in trigger payload!");
                try {
                    const pushResult = await webpush.sendNotification(subscription, notificationPayload);
                    console.log("Push sent successfully!", pushResult.statusCode);
                    return NextResponse.json({
                        success: true,
                        message: 'Sent notification right back to client device',
                        statusCode: pushResult.statusCode,
                        diagnostics: pushDiagnostics()
                    });
                } catch (err) {
                    console.error('Failed to send to direct sub', err.statusCode, err.body, err);
                    const providerBody = err.body || '';
                    const vapidMismatch = typeof providerBody === 'string' && providerBody.toLowerCase().includes('vapid public key mismatch');
                    return NextResponse.json(
                        {
                            success: false,
                            error: err.message,
                            statusCode: err.statusCode || 500,
                            providerError: providerBody || null,
                            endpoint: err.endpoint || null,
                            diagnostics: pushDiagnostics(),
                            hint: vapidMismatch
                                ? 'Subscription was created with a different VAPID public key. Re-subscribe this device using current key and retry.'
                                : '401 unauthenticated from push provider usually means missing or invalid VAPID Authorization header.'
                        },
                        { status: err.statusCode || 500 }
                    );
                }
            }

            // Fallback: sweep any existing in-memory subscriptions
            console.log(`Sending push to ${subscriptions.size} in-memory subscribers...`);
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
                message: `Sent ${promises.length} notifications`,
                diagnostics: pushDiagnostics()
            });
        }
        
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Push API Error:', error);
        return NextResponse.json({ error: error.message, diagnostics: pushDiagnostics() }, { status: 500 });
    }
}