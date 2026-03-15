"""
smart_alerts.py — Rule-Based Alert Engine for Project Canopy

Generates personalized vendor safety alerts using REAL Open-Meteo weather data
and the vendor's specific inventory type. This module activates as a fallback 
when Amazon Bedrock (Nova) is unavailable, but produces genuinely useful alerts
using deterministic weather threshold logic.

The output format is identical to Bedrock's JSON shape, so the frontend
requires zero changes to render these alerts.
"""

# WMO Weather Code groups
RAIN_CODES = {51, 53, 55, 61, 63, 65, 80, 81, 82}
SNOW_CODES = {71, 73, 75}
STORM_CODES = {95, 96, 99}
FOG_CODES = {45, 48}
DRIZZLE_CODES = {51, 53, 55}

# Language-aware alert templates
# Each template: (urgency, alert_text)
# {temp}, {wind}, {inv} are interpolated at runtime

ALERT_RULES = {
    "en": {
        "extreme_heat": {
            "Produce":     ("HIGH",   "Temperature is {temp}°C — perishable goods are at critical spoilage risk. Move all produce to shade immediately and cover with damp cloth to slow wilting."),
            "Electronics": ("HIGH",   "Temperature is {temp}°C — electronic displays and batteries risk overheating. Power down all devices and move to a shaded, ventilated area."),
            "Paper Goods": ("MEDIUM", "Temperature is {temp}°C — prolonged heat may cause ink fading and paper curling. Keep stock covered and away from direct sunlight."),
            "Clothing":    ("LOW",    "Temperature is {temp}°C — minimal direct risk to clothing. Ensure staff hydration and consider shade for customer comfort.")
        },
        "heavy_rain": {
            "Produce":     ("MEDIUM", "Rain detected with {wind} km/h winds. Cover produce tables with waterproof tarps. Root vegetables are safe; prioritize covering leafy greens and cut fruit."),
            "Electronics": ("HIGH",   "Rain detected — CRITICAL moisture risk for electronics. Immediately disconnect all power sources and cover all equipment with waterproof sheeting."),
            "Paper Goods": ("HIGH",   "Rain detected — paper products will be destroyed by moisture. All stock must be moved under solid cover or sealed in plastic bags immediately."),
            "Clothing":    ("MEDIUM", "Rain detected with {wind} km/h winds. Move clothing racks under cover. Leather and suede items are most vulnerable — prioritize covering those items first.")
        },
        "strong_wind": {
            "Produce":     ("MEDIUM", "Winds at {wind} km/h detected. Secure lightweight produce baskets and signage. Move any stacked displays to ground level to prevent toppling."),
            "Electronics": ("MEDIUM", "Winds at {wind} km/h detected. Brace all standing display units and secure any hanging signage. Move fragile items off elevated surfaces."),
            "Paper Goods": ("HIGH",   "Winds at {wind} km/h detected — loose paper products WILL scatter. Weight down all stacks, secure packaging, and consider temporarily halting display of loose items."),
            "Clothing":    ("HIGH",   "Winds at {wind} km/h detected. Anchor all hanging racks and clothing displays. Remove any lightweight items from hangers and fold them into secured bins.")
        },
        "thunderstorm": {
            "Produce":     ("HIGH",   "⚡ Thunderstorm approaching your area. Pack all inventory and seek solid shelter immediately. Lightning and hail pose direct physical danger — do not wait."),
            "Electronics": ("HIGH",   "⚡ Thunderstorm approaching — CRITICAL RISK. Disconnect all power immediately. Pack equipment and move to solid shelter. Lightning can destroy ungrounded electronics."),
            "Paper Goods": ("HIGH",   "⚡ Thunderstorm approaching with potential hail. All paper stock must be packed and moved to solid shelter immediately. Do not attempt to use tarps in storm winds."),
            "Clothing":    ("HIGH",   "⚡ Thunderstorm approaching your area. Pack all inventory and secure folding structures. Seek solid shelter immediately — canopies cannot withstand storm-force winds.")
        },
        "cold": {
            "Produce":     ("MEDIUM", "Temperature dropped to {temp}°C. Frost-sensitive produce (tomatoes, herbs, leafy greens) must be covered or moved indoors. Root vegetables are safe."),
            "Electronics": ("LOW",    "Temperature is {temp}°C. Cold weather may reduce battery life in display devices. Keep backup batteries warm in insulated pouches."),
            "Paper Goods": ("LOW",    "Temperature is {temp}°C. Cold condensation may form on surfaces — keep paper products elevated and wrapped in plastic during early morning hours."),
            "Clothing":    ("LOW",    "Temperature is {temp}°C — this may increase foot traffic for warm clothing. Display jackets and sweaters prominently. Secure lightweight items against wind.")
        },
        "clear": {
            "Produce":     ("LOW",    "Clear conditions at {temp}°C with light {wind} km/h winds. Optimal selling conditions. Monitor shade as the sun moves — reposition produce away from direct heat by midday."),
            "Electronics": ("LOW",    "Clear conditions at {temp}°C. Good selling conditions. If temperature rises above 35°C later, plan to shade electronic displays. UV exposure can damage screens over time."),
            "Paper Goods": ("LOW",    "Clear conditions at {temp}°C. Good selling conditions. Avoid direct prolonged sunlight on printed materials which may cause ink fading over several hours."),
            "Clothing":    ("LOW",    "Clear conditions at {temp}°C with gentle {wind} km/h winds. Ideal conditions for open-air display. Ensure hanging items are clipped to prevent wind displacement.")
        }
    },
    "hi": {
        "extreme_heat": {
            "Produce":     ("HIGH",   "तापमान {temp}°C है — जल्दी खराब होने वाला सामान खतरे में है। तुरंत सभी सब्जियों को छाया में रखें और गीले कपड़े से ढकें।"),
            "Electronics": ("HIGH",   "तापमान {temp}°C है — इलेक्ट्रॉनिक डिवाइस ज़्यादा गरम हो सकते हैं। सभी उपकरणों को बंद करें और छायादार जगह पर रखें।"),
            "Paper Goods": ("MEDIUM", "तापमान {temp}°C है — कागज़ मुड़ सकता है और स्याही फीकी पड़ सकती है। सामान को धूप से दूर और ढककर रखें।"),
            "Clothing":    ("LOW",    "तापमान {temp}°C है — कपड़ों पर कम खतरा। ग्राहकों की सुविधा के लिए छाया की व्यवस्था करें।")
        },
        "heavy_rain": {
            "Produce":     ("MEDIUM", "बारिश हो रही है, हवा {wind} km/h। ताज़ी सब्जियों और कटे फलों को तिरपाल से ढकें।"),
            "Electronics": ("HIGH",   "बारिश — इलेक्ट्रॉनिक्स को तुरंत बिजली से अलग करें और वाटरप्रूफ शीट से ढकें।"),
            "Paper Goods": ("HIGH",   "बारिश — कागज़ का सामान तुरंत ठोस आश्रय में रखें या प्लास्टिक बैग में सील करें।"),
            "Clothing":    ("MEDIUM", "बारिश, हवा {wind} km/h। कपड़ों को ढककर रखें। चमड़े का सामान पहले ढकें।")
        },
        "strong_wind": {
            "Produce":     ("MEDIUM", "हवा {wind} km/h चल रही है। हल्की टोकरियाँ और साइनबोर्ड सुरक्षित करें।"),
            "Electronics": ("MEDIUM", "हवा {wind} km/h। खड़े डिस्प्ले यूनिट को सहारा दें और नाज़ुक सामान नीचे रखें।"),
            "Paper Goods": ("HIGH",   "हवा {wind} km/h — खुला कागज़ उड़ जाएगा। सभी ढेरों पर वज़न रखें और प्रदर्शन रोकें।"),
            "Clothing":    ("HIGH",   "हवा {wind} km/h। हैंगर रैक सुरक्षित करें और हल्के कपड़े बक्सों में मोड़कर रखें।")
        },
        "thunderstorm": {
            "Produce":     ("HIGH",   "⚡ तूफान आ रहा है। सारा सामान पैक करें और मज़बूत आश्रय में जाएँ। इंतज़ार न करें।"),
            "Electronics": ("HIGH",   "⚡ तूफान — सभी बिजली के उपकरण तुरंत बंद करें। सामान पैक करें और सुरक्षित स्थान पर जाएँ।"),
            "Paper Goods": ("HIGH",   "⚡ तूफान आ रहा है। सारा कागज़ी सामान पैक करें और ठोस आश्रय में जाएँ।"),
            "Clothing":    ("HIGH",   "⚡ तूफान आ रहा है। सारा सामान पैक करें, तह लगाने वाले स्ट्रक्चर सुरक्षित करें और आश्रय लें।")
        },
        "cold": {
            "Produce":     ("MEDIUM", "तापमान {temp}°C। टमाटर, जड़ी-बूटियाँ और पत्तेदार सब्जियाँ ढकें। जड़ वाली सब्जियाँ सुरक्षित हैं।"),
            "Electronics": ("LOW",    "तापमान {temp}°C। ठंड में बैटरी जल्दी खत्म होती है। अतिरिक्त बैटरी गर्म रखें।"),
            "Paper Goods": ("LOW",    "तापमान {temp}°C। ठंडी सतहों पर नमी जम सकती है — कागज़ का सामान ऊपर और प्लास्टिक में रखें।"),
            "Clothing":    ("LOW",    "तापमान {temp}°C — गर्म कपड़ों की माँग बढ़ सकती है। जैकेट प्रमुखता से प्रदर्शित करें।")
        },
        "clear": {
            "Produce":     ("LOW",    "साफ मौसम, {temp}°C, हवा {wind} km/h। अच्छी बिक्री की स्थिति। दोपहर तक सब्जियों को धूप से बचाएँ।"),
            "Electronics": ("LOW",    "साफ मौसम, {temp}°C। अच्छी स्थिति। तापमान 35°C से ऊपर जाए तो डिस्प्ले को छाया में रखें।"),
            "Paper Goods": ("LOW",    "साफ मौसम, {temp}°C। अच्छी स्थिति। छपी सामग्री को लंबे समय तक सीधी धूप से बचाएँ।"),
            "Clothing":    ("LOW",    "साफ मौसम, {temp}°C, हवा {wind} km/h। खुले प्रदर्शन के लिए आदर्श। हैंगर पर कपड़े क्लिप करें।")
        }
    },
    "ta": {
        "extreme_heat": {"Produce": ("HIGH", "வெப்பநிலை {temp}°C — காய்கறிகள் கெட்டுப்போகும் அபாயம். உடனடியாக நிழலுக்கு மாற்றவும்."), "Electronics": ("HIGH", "வெப்பநிலை {temp}°C — சாதனங்கள் சூடாகலாம். நிழலில் வைக்கவும்."), "Paper Goods": ("MEDIUM", "வெப்பநிலை {temp}°C — காகிதங்களை வெயிலில் இருந்து பாதுகாக்கவும்."), "Clothing": ("LOW", "வெப்பநிலை {temp}°C — வாடிக்கையாளர்களுக்கு நிழல் தரவும்.")},
        "heavy_rain": {"Produce": ("MEDIUM", "மழை, காற்று {wind} km/h. காய்கறிகளை தார்ப்பாய் கொண்டு மூடவும்."), "Electronics": ("HIGH", "மழை — மின் சாதனங்களை உடனடியாக அணைத்து மூடவும்."), "Paper Goods": ("HIGH", "மழை — காகித பொருட்களை உடனடியாக பாதுகாப்பான இடத்திற்கு மாற்றவும்."), "Clothing": ("MEDIUM", "மழை, காற்று {wind} km/h. துணிகளை மூடவும்.")},
        "strong_wind": {"Produce": ("MEDIUM", "காற்று {wind} km/h. லேசான பொருட்களைப் பாதுகாக்கவும்."), "Electronics": ("MEDIUM", "காற்று {wind} km/h. சாதனங்களை பாதுகாப்பாக வைக்கவும்."), "Paper Goods": ("HIGH", "காற்று {wind} km/h — காகிதங்கள் பறக்கலாம். எடை வைக்கவும்."), "Clothing": ("HIGH", "காற்று {wind} km/h. ஆடைகளைத் தப்பாமல் கட்டவும்.")},
        "thunderstorm": {"Produce": ("HIGH", "⚡ இடியுடன் மழை. பாதுகாப்பான இடத்திற்குச் செல்லவும்."), "Electronics": ("HIGH", "⚡ இடியுடன் மழை — மின்சாரத்தை துண்டிக்கவும். பாதுகாப்பான இடத்திற்குச் செல்லவும்."), "Paper Goods": ("HIGH", "⚡ இடியுடன் மழை. காகிதங்களை பேக் செய்யவும்."), "Clothing": ("HIGH", "⚡ இடியுடன் மழை. சரக்குகளை பேக் செய்து பாதுகாப்பான இடத்திற்குச் செல்லவும்.")},
        "cold": {"Produce": ("MEDIUM", "வெப்பநிலை {temp}°C. காய்கறிகளை மூடவும்."), "Electronics": ("LOW", "வெப்பநிலை {temp}°C. பேட்டரிகளை சூடாக வைக்கவும்."), "Paper Goods": ("LOW", "வெப்பநிலை {temp}°C. பிளாஸ்டிக்கில் மூடவும்."), "Clothing": ("LOW", "வெப்பநிலை {temp}°C — சூடான ஆடைகளை முன்னிலைப்படுத்தவும்.")},
        "clear": {"Produce": ("LOW", "தெளிவான வானம், {temp}°C. நல்ல விற்பனை நிலை."), "Electronics": ("LOW", "தெளிவான வானம், {temp}°C. நல்ல விற்பனை நிலை."), "Paper Goods": ("LOW", "தெளிவான வானம், {temp}°C. நல்ல நிலை."), "Clothing": ("LOW", "தெளிவான வானம், {temp}°C. நல்ல விற்பனை நிலை.")}
    },
    "te": {
        "extreme_heat": {"Produce": ("HIGH", "ఉష్ణోగ్రత {temp}°C — తాజా కూరగాయలు పాడయ్యే ప్రమాదం ఉంది. తక్షణమే నీడలోకి మార్చండి."), "Electronics": ("HIGH", "ఉష్ణోగ్రత {temp}°C — పరికరాలు వేడెక్కవచ్చు. నీడలో ఉంచండి."), "Paper Goods": ("MEDIUM", "ఉష్ణోగ్రత {temp}°C — కాగితాలను ఎండ నుండి రక్షించండి."), "Clothing": ("LOW", "ఉష్ణోగ్రత {temp}°C — వినియోగదారులకు నీడ కల్పించండి.")},
        "heavy_rain": {"Produce": ("MEDIUM", "వర్షం, గాలి {wind} km/h. కూరగాయలను టార్పాలిన్‌తో కప్పండి."), "Electronics": ("HIGH", "వర్షం — ఎలక్ట్రానిక్స్‌ను వెంటనే ఆపి కప్పండి."), "Paper Goods": ("HIGH", "వర్షం — కాగితపు వస్తువులను తక్షణమే సురక్షిత ప్రాంతానికి మార్చండి."), "Clothing": ("MEDIUM", "వర్షం, గాలి {wind} km/h. దుస్తులను కప్పండి.")},
        "strong_wind": {"Produce": ("MEDIUM", "గాలి {wind} km/h. తేలికపాటి వస్తువులను భద్రపరచండి."), "Electronics": ("MEDIUM", "గాలి {wind} km/h. పరికరాలను భద్రంగా ఉంచండి."), "Paper Goods": ("HIGH", "గాలి {wind} km/h — కాగితాలు ఎగిరిపోవచ్చు. బరువు పెట్టండి."), "Clothing": ("HIGH", "గాలి {wind} km/h. దుస్తులను గట్టిగా కట్టండి.")},
        "thunderstorm": {"Produce": ("HIGH", "⚡ ఉరుములతో వర్షం. సురక్షిత ప్రాంతానికి వెళ్ళండి."), "Electronics": ("HIGH", "⚡ ఉరుములతో వర్షం — విద్యుత్ ఆపివేయండి. సురక్షిత ప్రాంతానికి వెళ్ళండి."), "Paper Goods": ("HIGH", "⚡ ఉరుములతో వర్షం. కాగితాలను ప్యాక్ చేయండి."), "Clothing": ("HIGH", "⚡ ఉరుములతో వర్షం. వస్తువులను ప్యాక్ చేసి సురక్షిత ప్రాంతానికి వెళ్ళండి.")},
        "cold": {"Produce": ("MEDIUM", "ఉష్ణోగ్రత {temp}°C. కూరగాయలను కప్పండి."), "Electronics": ("LOW", "ఉష్ణోగ్రత {temp}°C. బ్యాటరీలను వెచ్చగా ఉంచండి."), "Paper Goods": ("LOW", "ఉష్ణోగ్రత {temp}°C. ప్లాస్టిక్‌లో కప్పండి."), "Clothing": ("LOW", "ఉష్ణోగ్రత {temp}°C — వెచ్చని దుస్తులను ప్రదర్శించండి.")},
        "clear": {"Produce": ("LOW", "నిర్మలమైన ఆకాశం, {temp}°C. మంచి విక్రయ పరిస్థితి."), "Electronics": ("LOW", "నిర్మలమైన ఆకాశం, {temp}°C. మంచి విక్రయ పరిస్థితి."), "Paper Goods": ("LOW", "నిర్మలమైన ఆకాశం, {temp}°C. మంచి పరిస్థితి."), "Clothing": ("LOW", "నిర్మలమైన ఆకాశం, {temp}°C. మంచి విక్రయ పరిస్థితి.")}
    },
    "bn": {
        "extreme_heat": {"Produce": ("HIGH", "তাপমাত্রা {temp}°C — তাজা সবজি নষ্ট হওয়ার ঝুঁকি। জলখাবার ছায়ায় রাখুন।"), "Electronics": ("HIGH", "তাপমাত্রা {temp}°C — ইলেকট্রনিক্স গরম হতে পারে। ছায়ায় রাখুন।"), "Paper Goods": ("MEDIUM", "তাপমাত্রা {temp}°C — কাগজ রোদ থেকে বাঁচান।"), "Clothing": ("LOW", "তাপমাত্রা {temp}°C — গ্রাহকদের ছায়ার ব্যবস্থা করুন।")},
        "heavy_rain": {"Produce": ("MEDIUM", "বৃষ্টি, বাতাস {wind} km/h। সবজি তেরপাল দিয়ে ঢেকে দিন।"), "Electronics": ("HIGH", "বৃষ্টি — অবিলম্বে ইলেকট্রনিক্স বন্ধ করুন এবং ঢেকে দিন।"), "Paper Goods": ("HIGH", "বৃষ্টি — কাগজের সামগ্রী দ্রুত নিরাপদ স্থানে সরান।"), "Clothing": ("MEDIUM", "বৃষ্টি, বাতাস {wind} km/h। পোশাক ঢেকে দিন।")},
        "strong_wind": {"Produce": ("MEDIUM", "বাতাস {wind} km/h। হালকা জিনিস সাবধানে রাখুন।"), "Electronics": ("MEDIUM", "বাতাস {wind} km/h। দামি জিনিসপত্র নিরাপদে রাখুন।"), "Paper Goods": ("HIGH", "বাতাস {wind} km/h — কাগজ উড়তে পারে। ওজন রাখুন।"), "Clothing": ("HIGH", "বাতাস {wind} km/h। পোশাক শক্ত করে বেঁধে রাখুন।")},
        "thunderstorm": {"Produce": ("HIGH", "⚡ বজ্রঝড়। নিরাপদ স্থানে যান।"), "Electronics": ("HIGH", "⚡ বজ্রঝড় — বিদ্যুৎ সংযোগ বিচ্ছিন্ন করুন। নিরাপদ স্থানে যান।"), "Paper Goods": ("HIGH", "⚡ বজ্রঝড়। কাগজের জিনিসপত্র প্যাক করুন।"), "Clothing": ("HIGH", "⚡ বজ্রঝড়। জিনিসপত্র প্যাক করে নিরাপদ স্থানে যান।")},
        "cold": {"Produce": ("MEDIUM", "তাপমাত্রা {temp}°C। সবজি ঢেকে রাখুন।"), "Electronics": ("LOW", "তাপমাত্রা {temp}°C। ব্যাটারি গরম রাখুন।"), "Paper Goods": ("LOW", "তাপমাত্রা {temp}°C। প্লাস্টিকে মুড়িয়ে রাখুন।"), "Clothing": ("LOW", "তাপমাত্রা {temp}°C — গরম পোশাক সামনে রাখুন।")},
        "clear": {"Produce": ("LOW", "পরিষ্কার আকাশ, {temp}°C। ভালো বিক্রির অবস্থা।"), "Electronics": ("LOW", "পরিষ্কার আকাশ, {temp}°C। ভালো বিক্রির অবস্থা।"), "Paper Goods": ("LOW", "পরিষ্কার আকাশ, {temp}°C। ভালো অবস্থা।"), "Clothing": ("LOW", "পরিষ্কার আকাশ, {temp}°C। ভালো বিক্রির অবস্থা।")}
    },
    "mr": {
        "extreme_heat": {"Produce": ("HIGH", "तापमान {temp}°C — भाज्या खराब होण्याचा धोका. तात्काळ सावलीत ठेवा."), "Electronics": ("HIGH", "तापमान {temp}°C — उपकरणे गरम होऊ शकतात. त्यांना सावलीत ठेवा."), "Paper Goods": ("MEDIUM", "तापमान {temp}°C — कागद उन्हापासून दूर ठेवा."), "Clothing": ("LOW", "तापमान {temp}°C — ग्राहकांसाठी सावलीची सोय करा.")},
        "heavy_rain": {"Produce": ("MEDIUM", "पाऊस, वारा {wind} km/h. भाज्या ताडपत्रीने झाकून ठेवा."), "Electronics": ("HIGH", "पाऊस — उपकरणांची वीज खंडित करा आणि त्यांना झाका."), "Paper Goods": ("HIGH", "पाऊस — कागदी वस्तू तातडीने सुरक्षित जागी हलवा."), "Clothing": ("MEDIUM", "पाऊस, वारा {wind} km/h. कपडे झाकून ठेवा.")},
        "strong_wind": {"Produce": ("MEDIUM", "वारा {wind} km/h. हलक्या वस्तू सुरक्षित ठेवा."), "Electronics": ("MEDIUM", "वारा {wind} km/h. उपकरणे सुरक्षित ठेवा."), "Paper Goods": ("HIGH", "वारा {wind} km/h — कागद उडू शकतो. वजन ठेवा."), "Clothing": ("HIGH", "वारा {wind} km/h. कपडे घट्ट बांधून ठेवा.")},
        "thunderstorm": {"Produce": ("HIGH", "⚡ वादळ. सुरक्षित ठिकाणी जा."), "Electronics": ("HIGH", "⚡ वादळ — वीज खंडित करा. सुरक्षित ठिकाणी जा."), "Paper Goods": ("HIGH", "⚡ वादळ. कागदी वस्तू पॅक करा."), "Clothing": ("HIGH", "⚡ वादळ. माल पॅक करून सुरक्षित ठिकाणी जा.")},
        "cold": {"Produce": ("MEDIUM", "तापमान {temp}°C. भाज्या झाकून ठेवा."), "Electronics": ("LOW", "तापमान {temp}°C. बॅटरी गरम ठेवा."), "Paper Goods": ("LOW", "तापमान {temp}°C. प्लॅस्टिकमध्ये गुंडाळा."), "Clothing": ("LOW", "तापमान {temp}°C — उबदार कपडे प्रदर्शित करा.")},
        "clear": {"Produce": ("LOW", "स्वच्छ आकाश, {temp}°C. विक्रीसाठी उत्तम स्थिती."), "Electronics": ("LOW", "स्वच्छ आकाश, {temp}°C. विक्रीसाठी उत्तम स्थिती."), "Paper Goods": ("LOW", "स्वच्छ आकाश, {temp}°C. उत्तम स्थिती."), "Clothing": ("LOW", "स्वच्छ आकाश, {temp}°C. विक्रीसाठी उत्तम स्थिती.")}
    },
    "kn": {
        "extreme_heat": {"Produce": ("HIGH", "ತಾಪಮಾನ {temp}°C — ತರಕಾರಿಗಳು ಹಾಳಾಗುವ ಅಪಾಯವಿದೆ. ನೆರಳಿಗೆ ವರ್ಗಾಯಿಸಿ."), "Electronics": ("HIGH", "ತಾಪಮಾನ {temp}°C — ಉಪಕರಣಗಳು ಬಿಸಿಯಾಗಬಹುದು. ನೆರಳಿನಲ್ಲಿ ಇಡಿ."), "Paper Goods": ("MEDIUM", "ತಾಪಮಾನ {temp}°C — ಕಾಗದವನ್ನು ಬಿಸಿಲಿನಿಂದ ಕಾಪಾಡಿ."), "Clothing": ("LOW", "ತಾಪಮಾನ {temp}°C — ಗ್ರಾಹಕರಿಗೆ ನೆರಳು ಒದಗಿಸಿ.")},
        "heavy_rain": {"Produce": ("MEDIUM", "ಮಳೆ, ಗಾಳಿ {wind} km/h. ತರಕಾರಿಗಳನ್ನು ಟಾರ್ಪಾಲಿನಿಂದ ಮುಚ್ಚಿ."), "Electronics": ("HIGH", "ಮಳೆ — ವಿದ್ಯುತ್ ಉಪಕರಣಗಳನ್ನು ಆಫ್ ಮಾಡಿ ಮತ್ತು ಮುಚ್ಚಿ."), "Paper Goods": ("HIGH", "ಮಳೆ — ಕಾಗದದ ವಸ್ತುಗಳನ್ನು ಸುರಕ್ಷಿತ ಸ್ಥಳಕ್ಕೆ ವರ್ಗಾಯಿಸಿ."), "Clothing": ("MEDIUM", "ಮಳೆ, ಗಾಳಿ {wind} km/h. ಬಟ್ಟೆಗಳನ್ನು ಮುಚ್ಚಿ.")},
        "strong_wind": {"Produce": ("MEDIUM", "ಗಾಳಿ {wind} km/h. ಹಗುರವಾದ ವಸ್ತುಗಳನ್ನು ಸುರಕ್ಷಿತಗೊಳಿಸಿ."), "Electronics": ("MEDIUM", "ಗಾಳಿ {wind} km/h. ಉಪಕರಣಗಳನ್ನು ಸುರಕ್ಷಿತವಾಗಿಡಿ."), "Paper Goods": ("HIGH", "ಗಾಳಿ {wind} km/h — ಕಾಗದಗಳು ಹಾರಬಹುದು. ತೂಕ ಇಡಿ."), "Clothing": ("HIGH", "ಗಾಳಿ {wind} km/h. ಬಟ್ಟೆಗಳನ್ನು ಭದ್ರವಾಗಿ ಕಟ್ಟಿ.")},
        "thunderstorm": {"Produce": ("HIGH", "⚡ ಗುಡುಗು ಮಳೆ. ಸುರಕ್ಷಿತ ಸ್ಥಳಕ್ಕೆ ತೆರಳಿ."), "Electronics": ("HIGH", "⚡ ಗುಡುಗು ಮಳೆ — ವಿದ್ಯುತ್ ಕಡಿತಗೊಳಿಸಿ. ಸುರಕ್ಷಿತ ಸ್ಥಳಕ್ಕೆ ತೆರಳಿ."), "Paper Goods": ("HIGH", "⚡ ಗುಡುಗು ಮಳೆ. ಕಾಗದಗಳನ್ನು ಪ್ಯಾಕ್ ಮಾಡಿ."), "Clothing": ("HIGH", "⚡ ಗುಡುಗು ಮಳೆ. ವಸ್ತುಗಳನ್ನು ಪ್ಯಾಕ್ ಮಾಡಿ ಸುರಕ್ಷಿತ ಸ್ಥಳಕ್ಕೆ ತೆರಳಿ.")},
        "cold": {"Produce": ("MEDIUM", "ತಾಪಮಾನ {temp}°C. ತರಕಾರಿಗಳನ್ನು ಮುಚ್ಚಿ."), "Electronics": ("LOW", "ತಾಪಮಾನ {temp}°C. ಬ್ಯಾಟರಿಗಳನ್ನು ಬೆಚ್ಚಗಿಡಿ."), "Paper Goods": ("LOW", "ತಾಪಮಾನ {temp}°C. ಪ್ಲಾಸ್ಟಿಕ್ ನಲ್ಲಿ ಮುಚ್ಚಿ."), "Clothing": ("LOW", "ತಾಪಮಾನ {temp}°C — ಬೆಚ್ಚಗಿನ ಬಟ್ಟೆಗಳನ್ನು ಪ್ರದರ್ಶಿಸಿ.")},
        "clear": {"Produce": ("LOW", "ನಿರ್ಮಲ ಆಕಾಶ, {temp}°C. ಉತ್ತಮ ಮಾರಾಟ ಸ್ಥಿತಿ."), "Electronics": ("LOW", "ನಿರ್ಮಲ ಆಕಾಶ, {temp}°C. ಉತ್ತಮ ಮಾರಾಟ ಸ್ಥಿತಿ."), "Paper Goods": ("LOW", "ನಿರ್ಮಲ ಆಕಾಶ, {temp}°C. ಉತ್ತಮ ಸ್ಥಿತಿ."), "Clothing": ("LOW", "ನಿರ್ಮಲ ಆಕಾಶ, {temp}°C. ಉತ್ತಮ ಮಾರಾಟ ಸ್ಥಿತಿ.")}
    },
    "gu": {
        "extreme_heat": {"Produce": ("HIGH", "તાપમાન {temp}°C — શાકભાજી બગડવાનું જોખમ. તાત્કાલિક છાયામાં ખસેડો."), "Electronics": ("HIGH", "તાપમાન {temp}°C — ઉપકરણો ગરમ થઈ શકે છે. છાયામાં રાખો."), "Paper Goods": ("MEDIUM", "તાપમાન {temp}°C — કાગળને તડકાથી બચાવો."), "Clothing": ("LOW", "તાપમાન {temp}°C — ગ્રાહકો માટે છાયા પૂરી પાડો.")},
        "heavy_rain": {"Produce": ("MEDIUM", "વરસાદ, પવન {wind} km/h. શાકભાજીને તાળપત્રીથી ઢાંકી દો."), "Electronics": ("HIGH", "વરસાદ — ઉપકરણોનો પાવર બંધ કરો અને ઢાંકી દો."), "Paper Goods": ("HIGH", "વરસાદ — કાગળની વસ્તુઓને સુરક્ષિત જગ્યાએ ખસેડો."), "Clothing": ("MEDIUM", "વરસાદ, પવન {wind} km/h. કપડાં ઢાંકી દો.")},
        "strong_wind": {"Produce": ("MEDIUM", "પવન {wind} km/h. હળવી વસ્તુઓ સુરક્ષિત કરો."), "Electronics": ("MEDIUM", "પવન {wind} km/h. ઉપકરણો સુરક્ષિત રાખો."), "Paper Goods": ("HIGH", "પવન {wind} km/h — કાગળ ઊડી શકે છે. વજન મૂકો."), "Clothing": ("HIGH", "પવન {wind} km/h. કપડાં મજબૂતીથી બાંધો.")},
        "thunderstorm": {"Produce": ("HIGH", "⚡ તોફાન. સુરક્ષિત જગ્યાએ જાઓ."), "Electronics": ("HIGH", "⚡ તોફાન — પાવર કાપી નાખો. સુરક્ષિત જગ્યાએ જાઓ."), "Paper Goods": ("HIGH", "⚡ તોફાન. કાગળની વસ્તુઓ પેક કરો."), "Clothing": ("HIGH", "⚡ તોફાન. માલસામાન પેક કરો અને સુરક્ષિત જગ્યાએ જાઓ.")},
        "cold": {"Produce": ("MEDIUM", "તાપમાન {temp}°C. શાકભાજી ઢાંકી દો."), "Electronics": ("LOW", "તાપમાન {temp}°C. બેટરી ગરમ રાખો."), "Paper Goods": ("LOW", "તાપમાન {temp}°C. પ્લાસ્ટિકમાં વીંટો."), "Clothing": ("LOW", "તાપમાન {temp}°C — ગરમ કપડાંનું પ્રદર્શન કરો.")},
        "clear": {"Produce": ("LOW", "સાફ આકાશ, {temp}°C. વેચાણ માટે સારી સ્થિતિ."), "Electronics": ("LOW", "સાફ આકાશ, {temp}°C. વેચાણ માટે સારી સ્થિતિ."), "Paper Goods": ("LOW", "સાફ આકાશ, {temp}°C. સારી સ્થિતિ."), "Clothing": ("LOW", "સાફ આકાશ, {temp}°C. વેચાણ માટે સારી સ્થિતિ.")}
    },
    "ml": {
        "extreme_heat": {"Produce": ("HIGH", "താപനില {temp}°C — പച്ചക്കറികൾ കേടാകാൻ സാധ്യതയുണ്ട്. തണലിലേക്ക് മാറ്റുക."), "Electronics": ("HIGH", "താപനില {temp}°C — ഉപകരണങ്ങൾ ചൂടാകാം. തണലിൽ വയ്ക്കുക."), "Paper Goods": ("MEDIUM", "താപനില {temp}°C — കടലാസുകൾ വെയിലിൽ നിന്ന് സംരക്ഷിക്കുക."), "Clothing": ("LOW", "താപനില {temp}°C — ഉപഭോക്താക്കൾക്ക് തണൽ നൽകുക.")},
        "heavy_rain": {"Produce": ("MEDIUM", "മഴ, കാറ്റ് {wind} km/h. പച്ചക്കറികൾ ടാർപോളിൻ ഉപയോഗിച്ച് മൂടുക."), "Electronics": ("HIGH", "മഴ — ഇലക്ട്രോണിക്സ് ഉടൻ ഓഫ് ചെയ്ത് മൂടുക."), "Paper Goods": ("HIGH", "മഴ — കടലാസ് ഉപകരണങ്ങൾ സുരക്ഷിത സ്ഥാനത്തേക്ക് മാറ്റുക."), "Clothing": ("MEDIUM", "മഴ, കാറ്റ് {wind} km/h. വസ്ത്രങ്ങൾ മൂടുക.")},
        "strong_wind": {"Produce": ("MEDIUM", "കാറ്റ് {wind} km/h. ഭാരം കുറഞ്ഞ വസ്തുക്കൾ സുരക്ഷിതമാക്കുക."), "Electronics": ("MEDIUM", "കാറ്റ് {wind} km/h. ഉപകരണങ്ങൾ സുരക്ഷിതമായി വയ്ക്കുക."), "Paper Goods": ("HIGH", "കാറ്റ് {wind} km/h — കടലാസുകൾ പറന്നേക്കാം. ഭാരം വയ്ക്കുക."), "Clothing": ("HIGH", "കാറ്റ് {wind} km/h. വസ്ത്രങ്ങൾ ഭദ്രമായി കെട്ടുക.")},
        "thunderstorm": {"Produce": ("HIGH", "⚡ ഇടിമിന്നൽ മഴ. സുരക്ഷിതമായ സ്ഥലത്തേക്ക് പോവുക."), "Electronics": ("HIGH", "⚡ ഇടിമിന്നൽ മഴ — വൈദ്യുതി വിച്ഛേദിക്കുക. സുരക്ഷിതമായ സ്ഥലത്തേക്ക് പോവുക."), "Paper Goods": ("HIGH", "⚡ ഇടിമിന്നൽ മഴ. കടലാസുകൾ പാക്ക് ചെയ്യുക."), "Clothing": ("HIGH", "⚡ ഇടിമിന്നൽ മഴ. സാധനങ്ങൾ പാക്ക് ചെയ്ത് സുരക്ഷിതമായ സ്ഥലത്തേക്ക് പോവുക.")},
        "cold": {"Produce": ("MEDIUM", "താപനില {temp}°C. പച്ചക്കറികൾ മൂടുക."), "Electronics": ("LOW", "താപനില {temp}°C. ബാറ്ററികൾ ചൂടായി സൂക്ഷിക്കുക."), "Paper Goods": ("LOW", "താപനില {temp}°C. പ്ലാസ്റ്റിക്കിൽ മൂടുക."), "Clothing": ("LOW", "താപനില {temp}°C — ചൂടുള്ള വസ്ത്രങ്ങൾ പ്രദർശിപ്പിക്കുക.")},
        "clear": {"Produce": ("LOW", "തെളിഞ്ഞ ആകാശം, {temp}°C. നല്ല വിൽപ്പന സാഹചര്യം."), "Electronics": ("LOW", "തെളിഞ്ഞ ആകാശം, {temp}°C. നല്ല വിൽപ്പന സാഹചര്യം."), "Paper Goods": ("LOW", "തെളിഞ്ഞ ആകാശം, {temp}°C. നല്ല സാഹചര്യം."), "Clothing": ("LOW", "തെളിഞ്ഞ ആകാശം, {temp}°C. നല്ല വിൽപ്പന സാഹചര്യം.")}
    }
}


def _classify_weather(weather_data):
    """Determine the dominant weather threat from Open-Meteo data."""
    code = weather_data.get('weathercode', 0)
    temp = weather_data.get('temperature', 25)
    wind = weather_data.get('windspeed', 0)
    
    if code in STORM_CODES:
        return "thunderstorm"
    if code in RAIN_CODES and wind > 30:
        return "heavy_rain"
    if code in RAIN_CODES:
        return "heavy_rain"
    if wind > 35:
        return "strong_wind"
    if temp > 38:
        return "extreme_heat"
    if temp < 5:
        return "cold"
    return "clear"


def generate_alert(weather_data, inventory_type, language='en'):
    """
    Produce a personalized safety alert based on real weather conditions
    and the vendor's inventory type.
    
    Returns the same JSON shape as Bedrock:
      {"urgency_level": "HIGH|MEDIUM|LOW", "mitigation_alert": "..."}
    """
    threat = _classify_weather(weather_data)
    temp = weather_data.get('temperature', 25)
    wind = weather_data.get('windspeed', 0)
    
    # Fall back to English if language templates don't exist
    lang_rules = ALERT_RULES.get(language, ALERT_RULES['en'])
    threat_rules = lang_rules.get(threat, lang_rules['clear'])
    
    # Fall back to Produce if inventory type not found
    urgency, template = threat_rules.get(inventory_type, threat_rules.get('Produce', ("MEDIUM", "Monitor weather conditions.")))
    
    alert_text = template.format(temp=round(temp, 1), wind=round(wind, 1), inv=inventory_type)
    
    return {
        "urgency_level": urgency,
        "mitigation_alert": alert_text
    }


if __name__ == "__main__":
    # Quick test
    import json
    test_weather = {"temperature": 42.1, "windspeed": 15, "weathercode": 0, "is_day": 1}
    
    for inv in ["Produce", "Electronics", "Paper Goods", "Clothing"]:
        result = generate_alert(test_weather, inv, language='en')
        print(f"\n[{inv}] {result['urgency_level']}")
        print(f"  {result['mitigation_alert']}")
    
    print("\n--- Hindi ---")
    result_hi = generate_alert(test_weather, "Produce", language='hi')
    print(json.dumps(result_hi, ensure_ascii=False, indent=2))
