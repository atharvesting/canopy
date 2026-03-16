"use client";

import { useState } from 'react';

// Utility function to convert Base64 URL to Uint8Array for VAPID key
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const toBase64Url = (buffer) => {
  if (!buffer) return null;
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export default function PushNotification({ 
  inventoryType, 
  setLocationStatus, 
  setNotificationStatus, 
  isActive, 
  setIsActive,
  setRealBedrockAnalysis,
  setRealRadarImage,
  setWeatherData,
  language,
  t
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const keyFingerprint = (key) => {
    if (!key || key.length < 12) return 'missing';
    return `${key.slice(0, 6)}...${key.slice(-6)}`;
  };

  const parseJsonSafely = async (resp) => {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  };

  const readResponseError = async (resp) => {
    let details = '';
    try {
      const json = await resp.json();
      details = json?.error || json?.providerError || JSON.stringify(json);
    } catch {
      details = await resp.text();
    }
    return `${resp.status} ${resp.statusText}${details ? ` - ${details}` : ''}`;
  };

  const shouldRotateSubscription = (errorText = '') => {
    const msg = errorText.toLowerCase();
    return (
      msg.includes('vapid public key mismatch') ||
      msg.includes('unauthenticated') ||
      msg.includes('authorization header must be specified')
    );
  };

  const subscribeWithCurrentKey = async (registration, publicVapidKey, { forceRotate = false } = {}) => {
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      const existingServerKey = toBase64Url(existingSub.options?.applicationServerKey);
      const expectedServerKey = publicVapidKey.replace(/=+$/, '');
      const mismatchedKey = existingServerKey && existingServerKey !== expectedServerKey;

      if (forceRotate || mismatchedKey) {
        console.log('Rotating stale push subscription...');
        await existingSub.unsubscribe();
      } else {
        return existingSub;
      }
    }

    console.log('Subscribing to PushManager...');
    const createdSub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });
    console.log('Successfully registered new push subscription!');
    return createdSub;
  };

  const registerSubscriptionOnServer = async (subscription) => {
    const subResp = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'subscribe',
        subscription
      })
    });

    if (!subResp.ok) {
      throw new Error(`Subscription registration failed: ${await readResponseError(subResp)}`);
    }
  };

  const triggerPushNotification = async ({ subscription, title, body, language }) => {
    const pushResp = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'trigger',
        title,
        body,
        language,
        subscription
      })
    });

    if (!pushResp.ok) {
      const clone = pushResp.clone();
      const errText = await readResponseError(pushResp);
      const payload = await parseJsonSafely(clone);
      const providerError = payload?.providerError || '';
      const hint = payload?.hint || '';
      throw new Error(`Push trigger failed: ${errText}${providerError ? ` | provider: ${providerError}` : ''}${hint ? ` | hint: ${hint}` : ''}`);
    }

    return pushResp.json();
  };

  const handleEnableAlerts = async () => {
    setIsProcessing(true);
    try {
      // 1. Capture Location
      let coords = null;
      if ('geolocation' in navigator) {
        coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => reject(err)
          );
        });
        setLocationStatus(`Enabled (${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)})`);
      } else {
        setLocationStatus('Unsupported');
      }

      // 2. Request Notification Permissions
      let pushSubscription = null;
      let swRegistration = null;
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const perm = await Notification.requestPermission();
          setNotificationStatus(perm === 'granted' ? 'Granted' : 'Denied');

          if (perm === 'granted') {
            // 3. Subscribe to Push Manager
            swRegistration = await navigator.serviceWorker.ready;
            if (swRegistration) {

              if (!publicVapidKey) {
                throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing in deployed environment.');
              }

              const diagResp = await fetch('/api/push', { method: 'GET', cache: 'no-store' });
              if (!diagResp.ok) {
                throw new Error(`Push diagnostics check failed: ${await readResponseError(diagResp)}`);
              }

              const diagData = await diagResp.json();
              const diagnostics = diagData?.diagnostics || {};
              if (!diagnostics.vapidConfigured) {
                throw new Error(`Server push is not configured: ${diagnostics.vapidConfigError || 'Unknown VAPID error'}`);
              }

              const clientFingerprint = keyFingerprint(publicVapidKey);
              if (diagnostics.publicKeyFingerprint && diagnostics.publicKeyFingerprint !== clientFingerprint) {
                throw new Error(
                  `Client/server VAPID public key mismatch. Client ${clientFingerprint}, Server ${diagnostics.publicKeyFingerprint}.`
                );
              }
              
              try {
                pushSubscription = await subscribeWithCurrentKey(swRegistration, publicVapidKey);
                await registerSubscriptionOnServer(pushSubscription);
                
              } catch (pushErr) {
                setNotificationStatus('Error');
                console.warn('Push subscription failed:', pushErr);
                alert('Push subscription failed. Please retry after refreshing the app.\n\n' + (pushErr?.message || String(pushErr)));
              }
            } else {
              console.warn('No service worker registration found. Skipping push subscription.');
              setNotificationStatus('Error');
            }
          }
        } catch (err) {
          console.warn('Notification permission issue:', err);
          setNotificationStatus('Error');
        }
      } else {
        setNotificationStatus('Unsupported');
      }

      // 4. Console log final JSON payload
      const payload = {
        location: coords,
        inventory_type: inventoryType,
        language: language,
        subscription: pushSubscription ? JSON.parse(JSON.stringify(pushSubscription)) : null
      };

      console.log('Final Registration Payload:', JSON.stringify(payload, null, 2));
      
      // 5. Query Next.js Edge API instead of local FastAPI
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: coords?.latitude || 26.9124, 
          longitude: coords?.longitude || 75.7873,
          inventory_type: inventoryType,
          language: language
        })
      });
      
      if (!response.ok) {
        throw new Error(`Edge API Server Error: ${response.status}`);
      }
      
      const apiResult = await response.json();
      console.log('Backend pipeline returned:', apiResult);
      
      // FIRE PUSH NOTIFICATION IMMEDIAITELY UPON ASSESSMENT SUCCESS
      if (pushSubscription && apiResult.assessment && apiResult.assessment.mitigation_alert) {
          console.log("Triggering Push API...");
          try {
              const pushData = await triggerPushNotification({
                subscription: pushSubscription,
                title: `Canopy Warning: ${apiResult.assessment.urgency_level}`,
                body: apiResult.assessment.mitigation_alert,
                language
              });
              console.log("Push API Trigger Response:", pushData);
          } catch(err) {
              const message = err?.message || String(err);
              console.error("Delayed test push failed", err);

              // Last-resort self-heal: if provider reports auth/key mismatch, rotate sub then retry once.
              if (swRegistration && publicVapidKey && shouldRotateSubscription(message)) {
                try {
                  pushSubscription = await subscribeWithCurrentKey(swRegistration, publicVapidKey, { forceRotate: true });
                  await registerSubscriptionOnServer(pushSubscription);
                  const retryPushData = await triggerPushNotification({
                    subscription: pushSubscription,
                    title: `Canopy Warning: ${apiResult.assessment.urgency_level}`,
                    body: apiResult.assessment.mitigation_alert,
                    language
                  });
                  console.log('Push retry succeeded after subscription rotation:', retryPushData);
                } catch (retryErr) {
                  console.error('Push retry failed after rotation', retryErr);
                  alert('Push send failed after automatic retry.\n\n' + (retryErr?.message || String(retryErr)));
                }
              } else {
                alert('Push send failed.\n\n' + message);
              }
          }
      }
      
      // Populate Dashboard UI state
      if (apiResult.assessment && !apiResult.assessment.error) {
        setRealBedrockAnalysis(apiResult.assessment);
      }
      if (apiResult.radar_base64) {
        setRealRadarImage(apiResult.radar_base64);
      }
      if (apiResult.weather_data) {
        setWeatherData(apiResult.weather_data);
      }
      
      // Navigate to Active Dashboard sequence
      setIsActive(true);

    } catch (error) {
      console.error('Error enabling safety alerts:', error);
      alert('Network Error' + '\n\n' + 'Failed to complete analysis request.' + '\n\n' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (isActive) {
    return null;
  }

  return (
    <button 
      onClick={handleEnableAlerts}
      disabled={isProcessing}
      className={`w-full font-bold py-4 px-4 rounded-sm transition-colors flex items-center justify-center space-x-2 border border-black ${
        isProcessing 
          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait'
          : 'bg-black hover:bg-gray-800 text-white'
      }`}
    >
      {!isProcessing && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )}
      {isProcessing && (
         <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
         </svg>
      )}
      <span className="tracking-wide uppercase text-sm">
        {isProcessing ? t.analyzing : t.enableAlerts}
      </span>
    </button>
  );
}
