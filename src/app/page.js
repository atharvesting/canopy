"use client";

import { useState, useRef, useEffect } from 'react';
import PushNotification from '@/components/PushNotification';
import SafeWindowClock from '@/components/SafeWindowClock';

// Import locale files
import en from '@/locales/en.json';
import hi from '@/locales/hi.json';
import ta from '@/locales/ta.json';
import te from '@/locales/te.json';
import bn from '@/locales/bn.json';
import mr from '@/locales/mr.json';
import kn from '@/locales/kn.json';
import gu from '@/locales/gu.json';
import ml from '@/locales/ml.json';

const locales = { en, hi, ta, te, bn, mr, kn, gu, ml };

const languageNames = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  bn: 'বাংলা',
  mr: 'मराठी',
  kn: 'ಕನ್ನಡ',
  gu: 'ગુજરાતી',
  ml: 'മലയാളം'
};

export default function Home() {
  const [language, setLanguage] = useState('en');
  const [inventoryType, setInventoryType] = useState('Produce');
  const [locationStatus, setLocationStatus] = useState('Disabled');
  const [notificationStatus, setNotificationStatus] = useState('Disabled');
  const [isActive, setIsActive] = useState(false);
  const [realBedrockAnalysis, setRealBedrockAnalysis] = useState(null);
  const [realRadarImage, setRealRadarImage] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);

  const t = locales[language] || en;

  // WMO Weather interpretation codes → localized labels from locale file
  const getWeatherLabel = (code) => {
    if (t.weatherLabels && t.weatherLabels[String(code)]) {
      return t.weatherLabels[String(code)];
    }
    // Fallback English labels if locale doesn't have weatherLabels
    const fallback = {
      0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Rime Fog', 51: 'Light Drizzle', 53: 'Moderate Drizzle',
      55: 'Dense Drizzle', 61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
      71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
      80: 'Rain Showers', 81: 'Moderate Showers', 82: 'Violent Showers',
      95: 'Thunderstorm', 96: 'Thunderstorm + Hail', 99: 'Severe Thunderstorm'
    };
    return fallback[code] || 'Unknown';
  };

  // WMO Weather code → icon character
  const getWeatherIcon = (code, isDay) => {
    if (code === 0) return isDay ? '☀️' : '🌙';
    if (code <= 2) return isDay ? '⛅' : '☁️';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 55) return '🌦️';
    if (code <= 65) return '🌧️';
    if (code <= 75) return '❄️';
    if (code <= 82) return '🌧️';
    return '⛈️';
  };

  // Fallback text if API payload is somehow empty
  const warningText = realBedrockAnalysis 
    ? realBedrockAnalysis.mitigation_alert 
    : t.fallbackAlert;

  // Reliable Universal TTS via our Next.js Edge Proxy
  const handlePlayVoiceAlert = () => {
    // If already playing, stop
    if (isSpeaking) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);

    try {
      // 1. Primary Strategy: Next.js API Proxy to bypass mobile CORS and User-Agent blocks
      const textToPlay = encodeURIComponent(warningText.replace(/—/g, '-')); // Sanitize em-dash for safety
      const url = `/api/tts?text=${textToPlay}&lang=${language}`;
      
      const audio = audioRef.current;
      if (!audio) throw new Error('Audio element not mounted');
      
      audio.src = url;
      audio.load();
      
      audio.onended = () => setIsSpeaking(false);
      
      audio.onerror = () => {
        console.warn("Backend audio proxy failed. Retrying with basic browser TTS fallback...");
        // 2. Secondary Strategy: Fallback to underlying browser Web Speech API
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(warningText);
          utterance.lang = language === 'en' ? 'en-US' : `${language}-IN`;
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        } else {
          setIsSpeaking(false);
        }
      };
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("Audio auto-play prevented:", err);
          audio.onerror(); // trigger the Web Speech API fallback
        });
      }

    } catch (e) {
      console.error(e);
      setIsSpeaking(false);
    }
  };

  // Pre-load voices on component mount to prevent empty getVoices() on first click
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Get localized inventory label for display
  const getLocalizedInventory = (key) => {
    return t.inventoryOptions[key] || key;
  };

  // Get localized status text
  const getLocalizedStatus = (status) => {
    if (status === 'Disabled') return t.disabled;
    if (status === 'Unsupported') return t.unsupported;
    if (status === 'Granted') return t.granted;
    if (status === 'Denied') return t.denied;
    if (status.includes('Enabled')) return status; // Keep coords as-is
    return status;
  };

  const handleReset = () => {
    setIsActive(false);
    setLocationStatus('Disabled');
    setNotificationStatus('Disabled');
    setRealBedrockAnalysis(null);
    setRealRadarImage(null);
    setWeatherData(null);
    
    if (isSpeaking) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center p-6 sm:p-12 font-sans text-gray-900">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-sm">
        <div className="border-b border-gray-200 p-6 flex justify-between items-center relative">
          <div className="flex items-center">
            {isActive && (
              <button 
                onClick={handleReset} 
                className="mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                title={t.resetInventory || "Go back"}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase">
                {t.title}
              </h1>
              <p className="text-gray-500 text-sm mt-1 uppercase tracking-widest font-mono">{t.subtitle}</p>
            </div>
          </div>
          {isActive && (
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-xs font-mono text-green-600 font-bold uppercase tracking-wider">{t.active}</span>
            </div>
          )}
        </div>
        
        <div className="p-6 space-y-8">
          {!isActive ? (
            <>
              {/* Language Selector */}
              <div>
                <label htmlFor="language" className="block text-xs font-bold uppercase tracking-wider text-gray-900 mb-2">
                  {t.languageLabel}
                </label>
                <div className="relative">
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full appearance-none bg-white border border-gray-200 text-gray-900 text-sm rounded-sm focus:ring-0 focus:outline-none focus:border-gray-900 block p-3 pr-8 transition-colors"
                  >
                    {Object.entries(languageNames).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-900">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Inventory Selector */}
              <div>
                <label htmlFor="inventory" className="block text-xs font-bold uppercase tracking-wider text-gray-900 mb-2">
                  {t.inventoryLabel}
                </label>
                <div className="relative">
                  <select
                    id="inventory"
                    value={inventoryType}
                    onChange={(e) => setInventoryType(e.target.value)}
                    className="w-full appearance-none bg-white border border-gray-200 text-gray-900 text-sm rounded-sm focus:ring-0 focus:outline-none focus:border-gray-900 block p-3 pr-8 transition-colors"
                  >
                    {Object.entries(t.inventoryOptions).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-900">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-sm p-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2">{t.statusLabel}</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t.location}:</span>
                  <span className={`text-xs font-mono px-2 py-1 rounded-sm border ${locationStatus.includes('Enabled') ? 'bg-black text-white border-black' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {getLocalizedStatus(locationStatus)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t.notifications}:</span>
                  <span className={`text-xs font-mono px-2 py-1 rounded-sm border ${notificationStatus === 'Granted' ? 'bg-black text-white border-black' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {getLocalizedStatus(notificationStatus)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {/* Weather Indicator */}
              {weatherData && (
                <div className="border border-gray-200 rounded-sm p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-4">
                    {t.currentConditions}
                  </h3>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-4xl leading-none">
                        {getWeatherIcon(weatherData.weathercode, weatherData.is_day)}
                      </span>
                      <div>
                        <p className="font-mono text-3xl font-bold tracking-tight text-gray-900">
                          {Math.round(weatherData.temperature)}°C
                        </p>
                        <p className="text-xs uppercase tracking-widest text-gray-500 font-mono">
                          {getWeatherLabel(weatherData.weathercode)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs font-mono text-gray-500">
                        <span className="text-gray-400">{t.wind}</span>{' '}
                        <span className="text-gray-900 font-bold">{weatherData.windspeed} km/h</span>
                      </p>
                      <p className="text-xs font-mono text-gray-500">
                        <span className="text-gray-400">{t.dir}</span>{' '}
                        <span className="text-gray-900 font-bold">{weatherData.winddirection}°</span>
                      </p>
                    </div>
                  </div>
                  {/* Temperature Colorbar */}
                  {weatherData.temperature_min != null && weatherData.temperature_max != null && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-mono text-blue-600 font-bold w-10 text-right">
                          {Math.round(weatherData.temperature_min)}°
                        </span>
                        <div className="flex-1 relative py-2">
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-sm overflow-hidden bg-gray-100">
                            {/* Gradient bar */}
                            <div 
                              className="absolute inset-0 rounded-sm"
                              style={{
                                background: 'linear-gradient(to right, #3b82f6, #22d3ee, #22c55e, #eab308, #f97316, #ef4444)'
                              }}
                            />
                          </div>
                          {/* Current temperature marker (raised dot) */}
                          {(() => {
                            const min = weatherData.temperature_min;
                            const max = weatherData.temperature_max;
                            const range = max - min;
                            const pct = range > 0 ? ((weatherData.temperature - min) / range) * 100 : 50;
                            const clampedPct = Math.max(0, Math.min(100, pct));
                            return (
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[3px] border-gray-900 rounded-full shadow-md z-10"
                                style={{ left: `${clampedPct}%`, marginLeft: '-8px' }}
                              />
                            );
                          })()}
                        </div>
                        <span className="text-xs font-mono text-red-500 font-bold w-10">
                          {Math.round(weatherData.temperature_max)}°
                        </span>
                      </div>
                      <p className="text-center text-xs font-mono text-gray-400 mt-1 uppercase tracking-widest">{t.dayRange}</p>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-sm">
                <div className="flex justify-between items-start border-b border-gray-200 pb-2 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 mt-1">
                    {t.aiAssessment} // {getLocalizedInventory(inventoryType)}
                  </h3>
                  <button 
                    onClick={handlePlayVoiceAlert}
                    className={`ml-3 p-2 rounded-full transition-colors flex-shrink-0 ${
                      isSpeaking 
                        ? 'bg-black text-white shadow-sm' 
                        : 'bg-white border border-gray-200 text-gray-700 hover:text-black hover:border-gray-300 shadow-sm'
                    }`}
                    title={isSpeaking ? (t.stopAlert || 'Stop') : t.playVoiceAlert}
                  >
                    {isSpeaking ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="font-mono text-sm leading-relaxed text-gray-800 mb-4">
                  <span className="font-bold">{t.warning}:</span> {warningText}
                </p>
                
                {weatherData?.hourly && (
                  <SafeWindowClock hourlyData={weatherData.hourly} t={t} />
                )}
              </div>
            </div>
          )}

          <PushNotification 
            inventoryType={inventoryType}
            setLocationStatus={setLocationStatus}
            setNotificationStatus={setNotificationStatus}
            isActive={isActive}
            setIsActive={setIsActive}
            setRealBedrockAnalysis={setRealBedrockAnalysis}
            setRealRadarImage={setRealRadarImage}
            setWeatherData={setWeatherData}
            language={language}
            t={t}
          />
        </div>
      </div>

      <audio ref={audioRef} className="hidden" playsInline />

      <footer className="mt-12 text-center text-xs text-gray-400 font-mono tracking-wide">
        <p>Built with ❤️ by</p>
        <p className="mt-1 text-gray-500 font-bold uppercase">Atharv Rawat • Sanidhya Bhatia • Deepesh Wadhwani</p>
        <a 
          href="https://github.com/atharvesting/canopy" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 mt-3 hover:text-gray-900 transition-colors"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          <span>View Source</span>
        </a>
      </footer>
    </main>
  );
}
