import { NextResponse } from 'next/server';

const ALERT_RULES = {
    "en": {
        "extreme_heat": {
            "Produce":     ["HIGH",   "Temperature is {temp}°C — perishable goods are at critical spoilage risk. Move all produce to shade immediately and cover with damp cloth to slow wilting."],
            "Electronics": ["HIGH",   "Temperature is {temp}°C — electronic displays and batteries risk overheating. Power down all devices and move to a shaded, ventilated area."],
            "Paper Goods": ["MEDIUM", "Temperature is {temp}°C — prolonged heat may cause ink fading and paper curling. Keep stock covered and away from direct sunlight."],
            "Clothing":    ["LOW",    "Temperature is {temp}°C — minimal direct risk to clothing. Ensure staff hydration and consider shade for customer comfort."]
        },
        "heavy_rain": {
            "Produce":     ["MEDIUM", "Rain detected with {wind} km/h winds. Cover produce tables with waterproof tarps. Root vegetables are safe; prioritize covering leafy greens and cut fruit."],
            "Electronics": ["HIGH",   "Rain detected — CRITICAL moisture risk for electronics. Immediately disconnect all power sources and cover all equipment with waterproof sheeting."],
            "Paper Goods": ["HIGH",   "Rain detected — paper products will be destroyed by moisture. All stock must be moved under solid cover or sealed in plastic bags immediately."],
            "Clothing":    ["MEDIUM", "Rain detected with {wind} km/h winds. Move clothing racks under cover. Leather and suede items are most vulnerable — prioritize covering those items first."]
        },
        "strong_wind": {
            "Produce":     ["MEDIUM", "Winds at {wind} km/h detected. Secure lightweight produce baskets and signage. Move any stacked displays to ground level to prevent toppling."],
            "Electronics": ["MEDIUM", "Winds at {wind} km/h detected. Brace all standing display units and secure any hanging signage. Move fragile items off elevated surfaces."],
            "Paper Goods": ["HIGH",   "Winds at {wind} km/h detected — loose paper products WILL scatter. Weight down all stacks, secure packaging, and consider temporarily halting display of loose items."],
            "Clothing":    ["HIGH",   "Winds at {wind} km/h detected. Anchor all hanging racks and clothing displays. Remove any lightweight items from hangers and fold them into secured bins."]
        },
        "thunderstorm": {
            "Produce":     ["HIGH",   "⚡ Thunderstorm approaching your area. Pack all inventory and seek solid shelter immediately. Lightning and hail pose direct physical danger — do not wait."],
            "Electronics": ["HIGH",   "⚡ Thunderstorm approaching — CRITICAL RISK. Disconnect all power immediately. Pack equipment and move to solid shelter. Lightning can destroy ungrounded electronics."],
            "Paper Goods": ["HIGH",   "⚡ Thunderstorm approaching with potential hail. All paper stock must be packed and moved to solid shelter immediately. Do not attempt to use tarps in storm winds."],
            "Clothing":    ["HIGH",   "⚡ Thunderstorm approaching your area. Pack all inventory and secure folding structures. Seek solid shelter immediately — canopies cannot withstand storm-force winds."]
        },
        "cold": {
            "Produce":     ["MEDIUM", "Temperature dropped to {temp}°C. Frost-sensitive produce (tomatoes, herbs, leafy greens) must be covered or moved indoors. Root vegetables are safe."],
            "Electronics": ["LOW",    "Temperature is {temp}°C. Cold weather may reduce battery life in display devices. Keep backup batteries warm in insulated pouches."],
            "Paper Goods": ["LOW",    "Temperature is {temp}°C. Cold condensation may form on surfaces — keep paper products elevated and wrapped in plastic during early morning hours."],
            "Clothing":    ["LOW",    "Temperature is {temp}°C — this may increase foot traffic for warm clothing. Display jackets and sweaters prominently. Secure lightweight items against wind."]
        },
        "clear": {
            "Produce":     ["LOW",    "Clear conditions at {temp}°C with light {wind} km/h winds. Optimal selling conditions. Monitor shade as the sun moves — reposition produce away from direct heat by midday."],
            "Electronics": ["LOW",    "Clear conditions at {temp}°C. Good selling conditions. If temperature rises above 35°C later, plan to shade electronic displays. UV exposure can damage screens over time."],
            "Paper Goods": ["LOW",    "Clear conditions at {temp}°C. Good selling conditions. Avoid direct prolonged sunlight on printed materials which may cause ink fading over several hours."],
            "Clothing":    ["LOW",    "Clear conditions at {temp}°C with gentle {wind} km/h winds. Ideal conditions for open-air display. Ensure hanging items are clipped to prevent wind displacement."]
        }
    },
    "hi": {
        "extreme_heat": {
            "Produce":     ["HIGH",   "तापमान {temp}°C है — जल्दी खराब होने वाला सामान खतरे में है। तुरंत सभी सब्जियों को छाया में रखें और गीले कपड़े से ढकें।"],
            "Electronics": ["HIGH",   "तापमान {temp}°C है — इलेक्ट्रॉनिक डिवाइस ज़्यादा गरम हो सकते हैं। सभी उपकरणों को बंद करें और छायादार जगह पर रखें।"],
            "Paper Goods": ["MEDIUM", "तापमान {temp}°C है — कागज़ मुड़ सकता है और स्याही फीकी पड़ सकती है। सामान को धूप से दूर और ढककर रखें।"],
            "Clothing":    ["LOW",    "तापमान {temp}°C है — कपड़ों पर कम खतरा। ग्राहकों की सुविधा के लिए छाया की व्यवस्था करें।"]
        },
        "heavy_rain": {
            "Produce":     ["MEDIUM", "बारिश हो रही है, हवा {wind} km/h। ताज़ी सब्जियों और कटे फलों को तिरपाल से ढकें।"],
            "Electronics": ["HIGH",   "बारिश — इलेक्ट्रॉनिक्स को तुरंत बिजली से अलग करें और वाटरप्रूफ शीट से ढकें।"],
            "Paper Goods": ["HIGH",   "बारिश — कागज़ का सामान तुरंत ठोस आश्रय में रखें या प्लास्टिक बैग में सील करें।"],
            "Clothing":    ["MEDIUM", "बारिश, हवा {wind} km/h। कपड़ों को ढककर रखें। चमड़े का सामान पहले ढकें।"]
        },
        "strong_wind": {
            "Produce":     ["MEDIUM", "हवा {wind} km/h चल रही है। हल्की टोकरियाँ और साइनबोर्ड सुरक्षित करें।"],
            "Electronics": ["MEDIUM", "हवा {wind} km/h। खड़े डिस्प्ले यूनिट को सहारा दें और नाज़ुक सामान नीचे रखें।"],
            "Paper Goods": ["HIGH",   "हवा {wind} km/h — खुला कागज़ उड़ जाएगा। सभी ढेरों पर वज़न रखें और प्रदर्शन रोकें।"],
            "Clothing":    ["HIGH",   "हवा {wind} km/h। हैंगर रैक सुरक्षित करें और हल्के कपड़े बक्सों में मोड़कर रखें।"]
        },
        "thunderstorm": {
            "Produce":     ["HIGH",   "⚡ तूफान आ रहा है। सारा सामान पैक करें और मज़बूत आश्रय में जाएँ। इंतज़ार न करें।"],
            "Electronics": ["HIGH",   "⚡ तूफान — सभी बिजली के उपकरण तुरंत बंद करें। सामान पैक करें और सुरक्षित स्थान पर जाएँ।"],
            "Paper Goods": ["HIGH",   "⚡ तूफान आ रहा है। सारा कागज़ी सामान पैक करें और ठोस आश्रय में जाएँ।"],
            "Clothing":    ["HIGH",   "⚡ तूफान आ रहा है। सारा सामान पैक करें, तह लगाने वाले स्ट्रक्चर सुरक्षित करें और आश्रय लें।"]
        },
        "cold": {
            "Produce":     ["MEDIUM", "तापमान {temp}°C। टमाटर, जड़ी-बूटियाँ और पत्तेदार सब्जियाँ ढकें। जड़ वाली सब्जियाँ सुरक्षित हैं।"],
            "Electronics": ["LOW",    "तापमान {temp}°C। ठंड में बैटरी जल्दी खत्म होती है। अतिरिक्त बैटरी गर्म रखें।"],
            "Paper Goods": ["LOW",    "तापमान {temp}°C। ठंडी सतहों पर नमी जम सकती है — कागज़ का सामान ऊपर और प्लास्टिक में रखें।"],
            "Clothing":    ["LOW",    "तापमान {temp}°C — गर्म कपड़ों की माँग बढ़ सकती है। जैकेट प्रमुखता से प्रदर्शित करें।"]
        },
        "clear": {
            "Produce":     ["LOW",    "साफ मौसम, {temp}°C, हवा {wind} km/h। अच्छी बिक्री की स्थिति। दोपहर तक सब्जियों को धूप से बचाएँ।"],
            "Electronics": ["LOW",    "साफ मौसम, {temp}°C। अच्छी स्थिति। तापमान 35°C से ऊपर जाए तो डिस्प्ले को छाया में रखें।"],
            "Paper Goods": ["LOW",    "साफ मौसम, {temp}°C। अच्छी स्थिति। छपी सामग्री को लंबे समय तक सीधी धूप से बचाएँ।"],
            "Clothing":    ["LOW",    "साफ मौसम, {temp}°C, हवा {wind} km/h। खुले प्रदर्शन के लिए आदर्श। हैंगर पर कपड़े क्लिप करें।"]
        }
    }
};

const STORM_CODES = [95, 96, 99];
const RAIN_CODES = [51, 53, 55, 61, 63, 65, 80, 81, 82];

function classifyWeather(weatherData) {
    const code = weatherData.weathercode || 0;
    const temp = weatherData.temperature || 25;
    const wind = weatherData.windspeed || 0;
    
    if (STORM_CODES.includes(code)) return "thunderstorm";
    if (RAIN_CODES.includes(code) && wind > 30) return "heavy_rain";
    if (RAIN_CODES.includes(code)) return "heavy_rain";
    if (wind > 35) return "strong_wind";
    if (temp > 38) return "extreme_heat";
    if (temp < 5) return "cold";
    return "clear";
}

function generateAlert(weatherData, inventoryType, language = 'en') {
    const threat = classifyWeather(weatherData);
    const temp = Math.round((weatherData.temperature || 25) * 10) / 10;
    const wind = Math.round((weatherData.windspeed || 0) * 10) / 10;
    
    const langRules = ALERT_RULES[language] || ALERT_RULES['en'];
    const threatRules = langRules[threat] || langRules['clear'];
    
    const rule = threatRules[inventoryType] || threatRules['Produce'] || ["MEDIUM", "Monitor weather conditions."];
    
    const alertText = rule[1]
        .replace('{temp}', temp)
        .replace('{wind}', wind)
        .replace('{inv}', inventoryType);
        
    return {
        urgency_level: rule[0],
        mitigation_alert: alertText
    };
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { latitude, longitude, inventory_type, language } = body;

        const lat = latitude || 26.9124;
        const lon = longitude || 75.7873;

        // Fetch exactly as hrrr_lambda.py did
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability,weathercode,temperature_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch from OpenMeteo');
        }
        
        const data = await response.json();
        
        // Match the python structure
        const weather_data = data.current_weather || {};
        if (data.daily) {
            weather_data.temperature_max = data.daily.temperature_2m_max?.[0];
            weather_data.temperature_min = data.daily.temperature_2m_min?.[0];
        }
        if (data.hourly) {
            weather_data.hourly = data.hourly;
        }

        const assessment = generateAlert(weather_data, inventory_type || 'Produce', language);

        return NextResponse.json({
            assessment: assessment,
            radar_base64: null, // Removed radar image
            weather_data: weather_data,
            source: "Next.js Edge API"
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
