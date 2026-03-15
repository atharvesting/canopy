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
      if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
        const perm = await Notification.requestPermission();
        setNotificationStatus(perm === 'granted' ? 'Granted' : 'Denied');

        if (perm === 'granted') {
          // 3. Subscribe to Push Manager
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYpPNs_Z2s';
            
            pushSubscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
          } else {
            console.warn('No service worker registration found. Skipping push subscription.');
          }
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
        throw new Error(`Local FastAPI Server Error: ${response.status}`);
      }
      
      const apiResult = await response.json();
      console.log('Backend pipeline returned:', apiResult);
      
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
      alert(t.connectionError + '\n\n' + t.serverCheck + '\n\n' + error.message);
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
