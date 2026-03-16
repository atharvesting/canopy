import { NextResponse } from 'next/server';

const ALERT_RULES = {
    "en": {
        "extreme_heat": {
            "Produce":     ["HIGH",   "Sustained heatwave ({temp}°C/humidity {humidity}%). Leafy greens will wilt fast; cover with damp gunny sacks. Use shade and source ice to prevent rot."],
            "Electronics": ["HIGH",   "Severe heat ({temp}°C). Direct sunlight will ruin batteries and melt plastic trims. Keep demo units in shade and do not charge phones in direct sun."],
            "Paper Goods": ["MEDIUM", "Severe heat ({temp}°C). Prolonged sun exposure fades packaging. Rotate display items under shade."],
            "Clothing":    ["LOW",    "Severe heat ({temp}°C). Minimal risk to clothes, but foot traffic will plummet midday. Keep stall shaded and stay hydrated."]
        },
        "heavy_rain": {
            "Produce":     ["MEDIUM", "Heavy rain expected. Throw a tarpaulin over fresh veg. Root vegetables are fine, but keep delicate fruits elevated."],
            "Electronics": ["HIGH",   "Rain expected. Cover all electronics with waterproof sheets immediately. Keep items off the ground."],
            "Paper Goods": ["HIGH",   "Rain expected. Moisture ruins paper. Pack away loose items into sealed bags."],
            "Clothing":    ["MEDIUM", "Rain expected. Shift racks indoors or under cover. Keep leather and silk items packed away."]
        },
        "strong_wind": {
            "Produce":     ["MEDIUM", "Gusty winds. Keep lightweight baskets weighed down so they don't tip over."],
            "Electronics": ["MEDIUM", "Gusty winds. Secure standing displays so they don't blow over."],
            "Paper Goods": ["HIGH",   "Gusty winds. Weigh down paper goods with stones or clips so they don't scatter in the street."],
            "Clothing":    ["HIGH",   "Gusty winds. Anchor clothing racks. Fasten garments firmly."]
        },
        "thunderstorm": {
            "Produce":     ["HIGH",   "Thunderstorm arriving. Secure your stall under a solid structure until it passes."],
            "Electronics": ["HIGH",   "Thunderstorm arriving. Pack valuable electronics into dry boxes. Disconnect street power."],
            "Paper Goods": ["HIGH",   "Thunderstorm arriving. Securely pack paper products into waterproof boxes. Seek shelter."],
            "Clothing":    ["HIGH",   "Thunderstorm arriving. Secure canopy and racks, take shelter."]
        },
        "cold": {
            "Produce":     ["LOW",    "Cooler weather ({temp}°C). Good for shelf life, keep delicate fruits covered at night."],
            "Electronics": ["LOW",    "Cooler weather ({temp}°C). Normal operations."],
            "Paper Goods": ["LOW",    "Cooler weather ({temp}°C). Watch out for morning dew."],
            "Clothing":    ["LOW",    "Cooler weather ({temp}°C). Good weather to display warmer wear."]
        },
        "clear": {
            "Produce":     ["LOW",    "Clear sky, {temp}°C. Good selling conditions. Keep produce hydrated."],
            "Electronics": ["LOW",    "Clear sky, {temp}°C. Good conditions."],
            "Paper Goods": ["LOW",    "Clear sky, {temp}°C. Good selling conditions."],
            "Clothing":    ["LOW",    "Clear sky, {temp}°C. Ideal weather to display items out front."]
        }
    },
    "hi": {
        "extreme_heat": {"Produce": ["HIGH", "लगातार लू ({temp}°C / {humidity}% नमी)। पत्तेदार सब्जियां जल्दी मुरझाएंगी; गीली बोरियों से ढकें। बर्फ का उपयोग करें।"], "Electronics": ["HIGH", "भयंकर गर्मी ({temp}°C)। सीधी धूप से बैटरी और प्लास्टिक को नुकसान होगा। छाया में रखें।"], "Paper Goods": ["MEDIUM", "भयंकर गर्मी ({temp}°C)। कागज़ का सामान धूप में पीला पड़ सकता है। छाया में रखें।"], "Clothing": ["LOW", "लू ({temp}°C)। कपड़ों को न्यूनतम खतरा, लेकिन ग्राहक कम होंगे। हाइड्रेटेड रहें।"]},
        "heavy_rain": {"Produce": ["MEDIUM", "भारी बारिश की संभावना। ताजी सब्जियों पर तिरपाल डालें। जड़ों वाली सब्जियाँ सुरक्षित हैं।"], "Electronics": ["HIGH", "बारिश की संभावना। सभी इलेक्ट्रॉनिक्स तुरंत वाटरप्रूफ शीट से ढकें। ज़मीन से ऊपर रखें।"], "Paper Goods": ["HIGH", "बारिश का अनुमान। नमी कागज़ को बर्बाद कर देगी। बैग में पैक करें।"], "Clothing": ["MEDIUM", "बारिश की संभावना। रैक को शेड के नीचे ले जाएं। चमड़े का सामान पैक करें।"]},
        "strong_wind": {"Produce": ["MEDIUM", "तेज हवा। हल्की टोकरियों में वजन रखें ताकि पलटें नहीं।"], "Electronics": ["MEDIUM", "तेज हवा। खड़े हुए डिस्प्ले सुरक्षित करें।"], "Paper Goods": ["HIGH", "तेज हवा। कागज़ के सामान पर वजन रखें ताकि उड़े नहीं।"], "Clothing": ["HIGH", "तेज हवा। कपड़ों के रैक बांधें।"]},
        "thunderstorm": {"Produce": ["HIGH", "तूफान आ रहा है। ठोस शेड के नीचे सुरक्षित रहें।"], "Electronics": ["HIGH", "तूफान। कीमती इलेक्ट्रॉनिक्स को सूखे बक्सों में रखें। पावर कार्ड हटाएं।"], "Paper Goods": ["HIGH", "तूफान। कागज़ के सामान को वाटरप्रूफ बॉक्स में सुरक्षित करें।"], "Clothing": ["HIGH", "तूफान आ रहा है। शेड और रैक सुरक्षित करें। आश्रय लें।"]},
        "cold": {"Produce": ["LOW", "ठंडा मौसम ({temp}°C)। फलों को रात में ढक कर रखें।"], "Electronics": ["LOW", "ठंडा मौसम ({temp}°C)। सामान्य स्थिति।"], "Paper Goods": ["LOW", "ठंडा मौसम ({temp}°C)। सुबह की ओस से सावधान।"], "Clothing": ["LOW", "ठंडा मौसम ({temp}°C)। गर्म कपड़े प्रदर्शित करने के लिए अच्छा दिन।"]},
        "clear": {"Produce": ["LOW", "साफ आसमान ({temp}°C)। बिक्री के लिए अच्छा दिन।"], "Electronics": ["LOW", "साफ आसमान ({temp}°C)। सामान्य स्थिति।"], "Paper Goods": ["LOW", "साफ आसमान ({temp}°C)। अच्छी स्थिति।"], "Clothing": ["LOW", "साफ आसमान ({temp}°C)। अच्छी स्थिति।"]}
    },
    "ta": {
        "extreme_heat": {"Produce": ["HIGH", "கடும் வெப்பம் ({temp}°C / {humidity}% ஈரப்பதம்). காய்கறிகள் விரைவாக வாடும்; ஈரச் சாக்குகளால் மூடவும்."], "Electronics": ["HIGH", "கடும் வெப்பம் ({temp}°C). பேட்டரிகள் சேதமடையும். நிழலில் வைக்கவும்."], "Paper Goods": ["MEDIUM", "கடும் வெப்பம் ({temp}°C). காகிதங்கள் மங்கலாம். நிழலில் வைக்கவும்."], "Clothing": ["LOW", "கடும் வெப்பம் ({temp}°C). கூட்டம் குறையும். நீர் அருந்தவும்."]},
        "heavy_rain": {"Produce": ["MEDIUM", "கனமழை. காய்கறிகளை தார்பாயால் மூடவும்."], "Electronics": ["HIGH", "மழை. மின்சாதனங்களை உடனடியாக தார்ப்பாயால் மூடவும்."], "Paper Goods": ["HIGH", "மழை. காகிதங்களைப் பாதுகாப்பாகப் பேக் செய்யவும்."], "Clothing": ["MEDIUM", "மழை. துணிகளை நிழலுக்கு மாற்றவும்."]},
        "strong_wind": {"Produce": ["MEDIUM", "பலத்த காற்று. மெல்லிய கூடைகளின் மேல் எடையை வைக்கவும்."], "Electronics": ["MEDIUM", "பலத்த காற்று. சாதனங்களைப் பாதுகாப்பாக வைக்கவும்."], "Paper Goods": ["HIGH", "பலத்த காற்று. காகிதங்களின் மீது எடையை வைக்கவும்."], "Clothing": ["HIGH", "பலத்த காற்று. துணிகளை வலுவாக கட்டவும்."]},
        "thunderstorm": {"Produce": ["HIGH", "இடி மின்னல். பாதுகாப்பான இடத்தை அடையவும்."], "Electronics": ["HIGH", "இடி மின்னல். மின்சாதனங்களை பாதுகாப்பான பெட்டிகளில் வைக்கவும்."], "Paper Goods": ["HIGH", "இடி மின்னல். காகிதங்களை பெட்டிகளில் வைக்கவும்."], "Clothing": ["HIGH", "இடி மின்னல். துணிகளைப் பாதுகாப்பான இடத்திற்கு மாற்றவும்."]},
        "cold": {"Produce": ["LOW", "குளிர்ந்த வானிலை ({temp}°C). காய்கறிகளை மூடி வைக்கவும்."], "Electronics": ["LOW", "குளிர்ந்த வானிலை ({temp}°C). இயல்பான நிலை."], "Paper Goods": ["LOW", "குளிர்ந்த வானிலை ({temp}°C). பனி குறித்து எச்சரிக்கையாக இருங்கள்."], "Clothing": ["LOW", "குளிர்ந்த வானிலை ({temp}°C). குளிர்கால ஆடைகளை விற்க சிறந்தது."]},
        "clear": {"Produce": ["LOW", "தெளிவான வானம் ({temp}°C). நன்னிலை."], "Electronics": ["LOW", "தெளிவான வானம் ({temp}°C). நன்னிலை."], "Paper Goods": ["LOW", "தெளிவான வானம் ({temp}°C). நன்னிலை."], "Clothing": ["LOW", "தெளிவான வானம் ({temp}°C). நன்னிலை."]}
    },
    "te": {
        "extreme_heat": {"Produce": ["HIGH", "తీవ్రమైన ఎండ ({temp}°C / {humidity}% తేమ). కూరగాయలు త్వరగా వాడిపోతాయి; తడి గోనె సంచులతో కప్పండి."], "Electronics": ["HIGH", "తీవ్రమైన ఎండ ({temp}°C). బ్యాటరీలు దెబ్బతింటాయి. నీడలో ఉంచండి."], "Paper Goods": ["MEDIUM", "తీవ్రమైన ఎండ ({temp}°C). వస్తువులు రంగు కోల్పోతాయి. నీడలో ఉంచండి."], "Clothing": ["LOW", "తీవ్రమైన ఎండ ({temp}°C). వస్తువులకు నష్టం లేదు. తగినంత నీరు త్రాగండి."]},
        "heavy_rain": {"Produce": ["MEDIUM", "భారీ వర్షం. కూరగాయలపై టార్పాలిన్ కప్పండి."], "Electronics": ["HIGH", "వర్షం. ఎలక్ట్రానిక్స్ పై ప్లాస్టిక్ కవర్లు వేయండి."], "Paper Goods": ["HIGH", "వర్షం. కాగితపు వస్తువులను ప్యాక్ చేయండి."], "Clothing": ["MEDIUM", "వర్షం. దుస్తులను నీడ లోకి మార్చండి."]},
        "strong_wind": {"Produce": ["MEDIUM", "బలమైన గాలి. తేలికపాటి వస్తువులపై బరువులు ఉంచండి."], "Electronics": ["MEDIUM", "బలమైన గాలి. డిస్ప్లే బోర్డులను కట్టండి."], "Paper Goods": ["HIGH", "బలమైన గాలి. కాగితాల పై బరువులు ఉంచండి."], "Clothing": ["HIGH", "బలమైన గాలి. దుస్తులు ఎగిరిపోకుండా గట్టిగా కట్టండి."]},
        "thunderstorm": {"Produce": ["HIGH", "ఈదురుగాలులు. సురక్షితమైన ప్రదేశానికి వెళ్ళండి."], "Electronics": ["HIGH", "ఈదురుగాలులు. ఎలక్ట్రానిక్స్ ప్యాక్ చేయండి."], "Paper Goods": ["HIGH", "ఈదురుగాలులు. వస్తువులను రక్షించండి."], "Clothing": ["HIGH", "ఈదురుగాలులు. వస్తువులను ప్యాక్ చేయండి."]},
        "cold": {"Produce": ["LOW", "చల్లని వాతావరణం ({temp}°C). పరికించండి."], "Electronics": ["LOW", "చల్లని వాతావరణం ({temp}°C). సాధారణం."], "Paper Goods": ["LOW", "చల్లని వాతావరణం ({temp}°C). మంచు ఉంటుంది."], "Clothing": ["LOW", "చల్లని వాతావరణం ({temp}°C). వెచ్చని దుస్తులు విక్రయించడానికి అనువైనది."]},
        "clear": {"Produce": ["LOW", "స్పష్టమైన ఆకాశం ({temp}°C). మంచి వాతావరణం."], "Electronics": ["LOW", "స్పష్టమైన ఆకాశం ({temp}°C). మంచి వాతావరణం."], "Paper Goods": ["LOW", "స్పష్టమైన ఆకాశం ({temp}°C). మంచి వాతావరణం."], "Clothing": ["LOW", "స్పష్టమైన ఆకాశం ({temp}°C). మంచి వాతావరణం."]}
    },
    "bn": {
        "extreme_heat": {"Produce": ["HIGH", "তীব্র গরম ({temp}°C / {humidity}% আর্দ্রতা)। শাকসবজি শুকিয়ে যাবে; ভেজা চট দিয়ে ঢেকে রাখুন।"], "Electronics": ["HIGH", "তীব্র গরম ({temp}°C)। ব্যাটারি গলে যেতে পারে। ছায়ায় রাখুন।"], "Paper Goods": ["MEDIUM", "তীব্র গরম ({temp}°C)। রোদে কাগজ বিবর্ণ হতে পারে।"], "Clothing": ["LOW", "তীব্র গরম ({temp}°C)। কাস্টমার কম হবে। ছায়ায় থাকুন।"]},
        "heavy_rain": {"Produce": ["MEDIUM", "ভারী বৃষ্টি। তেরপাল দিয়ে সবজি ঢেকে দিন।"], "Electronics": ["HIGH", "বৃষ্টি। ইলেকট্রনিক্স দ্রুত ঢেকে ফেলুন।"], "Paper Goods": ["HIGH", "বৃষ্টি। কাগজের জিনিসপত্র প্যাক করে ফেলুন।"], "Clothing": ["MEDIUM", "বৃষ্টি। পোশাক ভিতরে নিন।"]},
        "strong_wind": {"Produce": ["MEDIUM", "জোরালো বাতাস। ঝুড়িগুলো ভারী দিয়ে আটকে রাখুন।"], "Electronics": ["MEDIUM", "জোরালো বাতাস। ডিসপ্লে ঠিক করুন।"], "Paper Goods": ["HIGH", "জোরালো বাতাস। কাগজের উপর ওজন রাখুন।"], "Clothing": ["HIGH", "জোরালো বাতাস। পোশাক শক্ত করে বেঁধে রাখুন।"]},
        "thunderstorm": {"Produce": ["HIGH", "বজ্রঝড়। নিরাপদ স্থানে যান।"], "Electronics": ["HIGH", "বজ্রঝড়। দামি জিনিস সেভ করুন।"], "Paper Goods": ["HIGH", "বজ্রঝড়। জিনিসপত্র বক্সে প্যাক করুন।"], "Clothing": ["HIGH", "বজ্রঝড়। সব কিছু সেফ করুন।"]},
        "cold": {"Produce": ["LOW", "শীতল আবহাওয়া ({temp}°C)। ফল ঢেকে রাখুন।"], "Electronics": ["LOW", "শীতল আবহাওয়া ({temp}°C)। স্বাভাবিক।"], "Paper Goods": ["LOW", "শীতল আবহাওয়া ({temp}°C)। শিশির থেকে বাঁচান।"], "Clothing": ["LOW", "শীতল আবহাওয়া ({temp}°C)। গরম পোশাক রাখার ভালো সময়।"]},
        "clear": {"Produce": ["LOW", "পরিষ্কার আকাশ ({temp}°C)। ভালো দিন।"], "Electronics": ["LOW", "পরিষ্কার আকাশ ({temp}°C)। স্বাভাবিক।"], "Paper Goods": ["LOW", "পরিষ্কার আকাশ ({temp}°C)। স্বাভাবিক।"], "Clothing": ["LOW", "পরিষ্কার আকাশ ({temp}°C)। স্বাভাবিক।"]}
    },
    "mr": {
        "extreme_heat": {"Produce": ["HIGH", "कडक ऊन ({temp}°C / {humidity}% आर्द्रता). भाज्या लवकर कोमेजतील; ओल्या गोणीने झाका."], "Electronics": ["HIGH", "कडक ऊन ({temp}°C). बॅटरींचे नुकसान होईल. सावलीत ठेवा."], "Paper Goods": ["MEDIUM", "कडक ऊन ({temp}°C). कागद फिकट होऊ शकतो. सावलीत ठेवा."], "Clothing": ["LOW", "कडक ऊन ({temp}°C). ग्राहकांची गर्दी कमी होईल. सावलीत राहा."]},
        "heavy_rain": {"Produce": ["MEDIUM", "मुसळधार पाऊस. भाज्यांवर ताडपत्री टाका."], "Electronics": ["HIGH", "पाऊस. सर्व ইলেকট্রॉनिक्स झाकून ठेवा."], "Paper Goods": ["HIGH", "पाऊस. कागदी वस्तू प्लास्टिकमध्ये पॅक करा."], "Clothing": ["MEDIUM", "पाऊस. कपडे आत घ्या."]},
        "strong_wind": {"Produce": ["MEDIUM", "सोसाट्याचा वारा. हलक्या टोपल्यांवर वजन ठेवा."], "Electronics": ["MEDIUM", "सोसाट्याचा वारा. डिस्प्ले सुरक्षित करा."], "Paper Goods": ["HIGH", "सोसाट्याचा वारा. कागदांवर वजन ठेवा."], "Clothing": ["HIGH", "सोसाट्याचा वारा. कपडे घट्ट बांधा."]},
        "thunderstorm": {"Produce": ["HIGH", "वादळ. सुरक्षित ठिकाणी जा."], "Electronics": ["HIGH", "वादळ. उपकरणे कोरड्या बॉक्समध्ये ठेवा."], "Paper Goods": ["HIGH", "वादळ. वस्तू सुरक्षित करा."], "Clothing": ["HIGH", "वादळ. सुरक्षित आश्रय घ्या."]},
        "cold": {"Produce": ["LOW", "थंड हवामान ({temp}°C). फळे झाका."], "Electronics": ["LOW", "थंड हवामान ({temp}°C). सामान्य."], "Paper Goods": ["LOW", "थंड हवामान ({temp}°C). दव पडू शकते."], "Clothing": ["LOW", "थंड हवामान ({temp}°C). गरम कपडे विकण्यासाठी उत्तम."]},
        "clear": {"Produce": ["LOW", "स्वच्छ आकाश ({temp}°C). उत्तम हवामान."], "Electronics": ["LOW", "स्वच्छ आकाश ({temp}°C). उत्तम हवामान."], "Paper Goods": ["LOW", "स्वच्छ आकाश ({temp}°C). उत्तम हवामान."], "Clothing": ["LOW", "स्वच्छ आकाश ({temp}°C). उत्तम हवामान."]}
    },
    "kn": {
        "extreme_heat": {"Produce": ["HIGH", "ಕಠಿಣ ಬಿಸಿಲು ({temp}°C / {humidity}% ಆರ್ದ್ರತೆ). ತರಕಾರಿಗಳು ಬಾಡಿಹೋಗುತ್ತವೆ; ಒದ್ದೆ ಗೋಣಿಚೀಲಗಳಿಂದ ಮುಚ್ಚಿ."], "Electronics": ["HIGH", "ಕಠಿಣ ಬಿಸಿಲು ({temp}°C). ಬ್ಯಾಟರಿಗಳು ಕರಗುತ್ತವೆ. ನೆರಳಿನಲ್ಲಿ ಇಡಿ."], "Paper Goods": ["MEDIUM", "ಕಠಿಣ ಬಿಸಿಲು ({temp}°C). ಕಾಗದ ಹಾಳಾಗಬಹುದು. ನೆರಳಿನಲ್ಲಿ ಇಡಿ."], "Clothing": ["LOW", "ಕಠಿಣ ಬಿಸಿಲು ({temp}°C). ಜನದಟ್ಟಣೆ ಕಡಿಮೆ. ನೆರಳಿನಲ್ಲಿರಿ."]},
        "heavy_rain": {"Produce": ["MEDIUM", "ಭಾರೀ ಮಳೆ. ತರಕಾರಿಗಳ ಮೇಲೆ ಟಾರ್ಪಲಿನ್ ಹಾಕಿ."], "Electronics": ["HIGH", "ಮಳೆ. ವಸ್ತುಗಳನ್ನು ಮುಚ್ಚಿ ಕವರ್ ಮಾಡಿ."], "Paper Goods": ["HIGH", "ಮಳೆ. ಕಾಗದ ವಸ್ತುಗಳನ್ನು ಸುರಕ್ಷಿತವಾಗಿಡಿ."], "Clothing": ["MEDIUM", "ಮಳೆ. ಬಟ್ಟೆಗಳನ್ನು ಒಳಗೆ ತನ್ನಿ."]},
        "strong_wind": {"Produce": ["MEDIUM", "ಬಲವಾದ ಗಾಳಿ. ಬುಟ್ಟಿಗಳ ಮೇಲೆ ಭಾರವಿಡಿ."], "Electronics": ["MEDIUM", "ಬಲವಾದ ಗಾಳಿ. ವಸ್ತುಗಳನ್ನು ಭದ್ರಪಡಿಸಿ."], "Paper Goods": ["HIGH", "ಬಲವಾದ ಗಾಳಿ. ಕಾಗದಗಳ ಮೇಲೆ ಕಲ್ಲುಗಳನ್ನಿಡಿ."], "Clothing": ["HIGH", "ಬಲವಾದ ಗಾಳಿ. ಬಟ್ಟೆಗಳನ್ನು ಗಟ್ಟಿಯಾಗಿ ಕಟ್ಟಿ."]},
        "thunderstorm": {"Produce": ["HIGH", "ಗುಡುಗು ಮಳೆ. ಸುರಕ್ಷಿತ ಸ್ಥಳಕ್ಕೆ ತೆರಳಿ."], "Electronics": ["HIGH", "ಗುಡುಗು ಮಳೆ. ವಿದ್ಯುತ್ ಉಪಕರಣಗಳನ್ನು ಪ್ಯಾಕ್ ಮಾಡಿ."], "Paper Goods": ["HIGH", "ಗುಡುಗು ಮಳೆ. ವಸ್ತುಗಳನ್ನು ಕಾಪಾಡಿ."], "Clothing": ["HIGH", "ಗುಡುಗು ಮಳೆ. ಬಟ್ಟೆಗಳನ್ನು ರಕ್ಷಿಸಿ."]},
        "cold": {"Produce": ["LOW", "ಚಳಿಗಾಲ ({temp}°C). ಹಣ್ಣುಗಳನ್ನು ಮುಚ್ಚಿಡಿ."], "Electronics": ["LOW", "ಚಳಿಗಾಲ ({temp}°C). ಸಾಮಾನ್ಯ."], "Paper Goods": ["LOW", "ಚಳಿಗಾಲ ({temp}°C). ಇಬ್ಬನಿಯಿಂದ ಕಾಪಾಡಿ."], "Clothing": ["LOW", "ಚಳಿಗಾಲ ({temp}°C). ಉಡುಪುಗಳನ್ನು ಮಾರಾಟ ಮಾಡಲು ಉತ್ತಮ."]},
        "clear": {"Produce": ["LOW", "ಸ್ವಚ್ಛ ಆಕಾಶ ({temp}°C). ಉತ್ತಮ ಹವಾಮಾನ."], "Electronics": ["LOW", "ಸ್ವಚ್ಛ ಆಕಾಶ ({temp}°C). ಸಾಮಾನ್ಯ."], "Paper Goods": ["LOW", "ಸ್ವಚ್ಛ ಆಕಾಶ ({temp}°C). ಸಾಮಾನ್ಯ."], "Clothing": ["LOW", "ಸ್ವಚ್ಛ ಆಕಾಶ ({temp}°C). ಸಾಮಾನ್ಯ."]}
    },
    "gu": {
        "extreme_heat": {"Produce": ["HIGH", "ખૂબ ગરમી ({temp}°C / {humidity}% ભેજ). શાકભાજી સુકાઈ જશે; ભીના કોથળાથી ઢાંકો. બરફનો ઉપયોગ કરો."], "Electronics": ["HIGH", "ખૂબ ગરમી ({temp}°C). બેટરી ખરાબ થશે. છાયામાં રાખો."], "Paper Goods": ["MEDIUM", "ખૂબ ગરમી ({temp}°C). કાગળ આછો પડી શકે છે."], "Clothing": ["LOW", "ખૂબ ગરમી ({temp}°C). ગ્રાહકો ઓછા આવશે. છાયામાં રહો."]},
        "heavy_rain": {"Produce": ["MEDIUM", "વરસાદ. તાલપત્રીથી ઢાંકી દો."], "Electronics": ["HIGH", "વરસાદ. ઇલેક્ટ્રોનિક્સને ઢાંકી દો."], "Paper Goods": ["HIGH", "વરસાદ. કાગળની વસ્તુઓને સુરક્ષિત રાખો."], "Clothing": ["MEDIUM", "વરસાદ. કપડાં અંદર લઈ લો."]},
        "strong_wind": {"Produce": ["MEDIUM", "પવન. ટોપલીઓ પર વજન મૂકો."], "Electronics": ["MEDIUM", "પવન. વસ્તુઓને બાંધી રાખો."], "Paper Goods": ["HIGH", "પવન. કાગળ પર વજન મૂકો."], "Clothing": ["HIGH", "પવન. કપડાંને મજબૂતીથી બાંધો."]},
        "thunderstorm": {"Produce": ["HIGH", "તોફાન. સુરક્ષિત જગ્યાએ જાઓ."], "Electronics": ["HIGH", "તોફાન. ઇલેક્ટ્રોનિક્સ પૅક કરો."], "Paper Goods": ["HIGH", "તોફાન. સારી રીતે પૅક કરો."], "Clothing": ["HIGH", "તોફાન. આશ્રય લો."]},
        "cold": {"Produce": ["LOW", "ઠંડુ વાતાવરણ ({temp}°C). ફળો ઢાંકી રાખો."], "Electronics": ["LOW", "ઠંડુ વાતાવરણ ({temp}°C). સામાન્ય."], "Paper Goods": ["LOW", "ઠંડુ વાતાવરણ ({temp}°C). સામાન્ય."], "Clothing": ["LOW", "ઠંડુ વાતાવરણ ({temp}°C). ગરમ કપડાંનું વેચાણ સારું થશે."]},
        "clear": {"Produce": ["LOW", "ચોખ્ખું વાતાવરણ ({temp}°C). સારો દિવસ."], "Electronics": ["LOW", "ચોખ્ખું વાતાવરણ ({temp}°C). સારો દિવસ."], "Paper Goods": ["LOW", "ચોખ્ખું વાતાવરણ ({temp}°C). સારો દિવસ."], "Clothing": ["LOW", "ચોખ્ખું વાતાવરણ ({temp}°C). સારો દિવસ."]}
    },
    "ml": {
        "extreme_heat": {"Produce": ["HIGH", "കഠിനമായ ചൂട് ({temp}°C / {humidity}% ഈർപ്പം). പച്ചക്കറികൾ വാടും; നനഞ്ഞ ചാക്കുകൊണ്ട് മൂടുക."], "Electronics": ["HIGH", "കഠിനമായ ചൂട് ({temp}°C). ബാറ്ററികൾ കേടാകും. തണലിൽ വയ്ക്കുക."], "Paper Goods": ["MEDIUM", "കഠിനമായ ചൂട് ({temp}°C). പേപ്പറുകൾ മങ്ങും."], "Clothing": ["LOW", "കഠിനമായ ചൂട് ({temp}°C). വിൽപന കുറയും. തണലിൽ നിൽക്കുക."]},
        "heavy_rain": {"Produce": ["MEDIUM", "കനത്ത മഴ. ടാർപോളിൻ ഉപയോഗിച്ച് മൂടുക."], "Electronics": ["HIGH", "മഴ. ഉപകരണങ്ങൾ നനയാതെ സൂക്ഷിക്കുക."], "Paper Goods": ["HIGH", "മഴ. പേപ്പറുകൾ പായ്ക്ക് ചെയ്യുക."], "Clothing": ["MEDIUM", "മഴ. വസ്ത്രങ്ങൾ ഉള്ളിലേക്ക് മാറ്റുക."]},
        "strong_wind": {"Produce": ["MEDIUM", "ശക്തമായ കാറ്റ്. ഭാരമുള്ള സാധനങ്ങൾ വയ്ക്കുക."], "Electronics": ["MEDIUM", "ശക്തമായ കാറ്റ്. ഉപകരണങ്ങൾ ഉറപ്പിക്കുക."], "Paper Goods": ["HIGH", "ശക്തമായ കാറ്റ്. പേപ്പറുകളിൽ ഭാരം വയ്ക്കുക."], "Clothing": ["HIGH", "ശക്തമായ കാറ്റ്. വസ്ത്രങ്ങൾ കെട്ടിവയ്ക്കുക."]},
        "thunderstorm": {"Produce": ["HIGH", "ഇടിമിന്നൽ. സുരക്ഷിത സ്ഥാനത്തേക്ക് മാറുക."], "Electronics": ["HIGH", "ഇടിമിന്നൽ. സാധനങ്ങൾ പായ്ക്ക് ചെയ്യുക."], "Paper Goods": ["HIGH", "ഇടിമിന്നൽ. സുരക്ഷിതമാക്കുക."], "Clothing": ["HIGH", "ഇടിമിന്നൽ. സുരക്ഷിതമായിരിക്കുക."]},
        "cold": {"Produce": ["LOW", "തണുപ്പ് ({temp}°C). പഴങ്ങൾ മൂടിവയ്ക്കുക."], "Electronics": ["LOW", "തണുപ്പ് ({temp}°C). സാധാരണ നില."], "Paper Goods": ["LOW", "തണുപ്പ് ({temp}°C). സാധാരണ നില."], "Clothing": ["LOW", "തണുപ്പ് ({temp}°C). ചൂടുള്ള വസ്ത്രങ്ങൾ വിൽക്കാൻ നല്ല സമയം."]},
        "clear": {"Produce": ["LOW", "തെളിഞ്ഞ ആകാശം ({temp}°C). നല്ല സമയം."], "Electronics": ["LOW", "തെളിഞ്ഞ ആകാശം ({temp}°C). നല്ല സമയം."], "Paper Goods": ["LOW", "തെളിഞ്ഞ ആകാശം ({temp}°C). നല്ല സമയം."], "Clothing": ["LOW", "തെളിഞ്ഞ ആകാശം ({temp}°C). നല്ല സമയം."]}
    }
};

const STORM_CODES = [95, 96, 99];
const RAIN_CODES = [51, 53, 55, 61, 63, 65, 80, 81, 82];

function classifyWeather(weatherData) {
    const code = weatherData.weathercode || 0;
    const temp = weatherData.temperature || 25;
    const wind = weatherData.windspeed || 0;
    const humidity = weatherData.relative_humidity_2m || 50;
    const apparentTemp = weatherData.apparent_temperature || temp;
    
    if (STORM_CODES.includes(code)) return "thunderstorm";
    if (apparentTemp > 40 || (temp > 35 && humidity > 60)) return "extreme_heat";
    if (RAIN_CODES.includes(code) && wind > 30) return "heavy_rain";
    if (RAIN_CODES.includes(code)) return "heavy_rain";
    if (wind > 35) return "strong_wind";
    if (temp < 5) return "cold";
    return "clear";
}

function generateAlert(weatherData, inventoryType, language = 'en') {
    const threat = classifyWeather(weatherData);
    const temp = Math.round((weatherData.temperature || 25) * 10) / 10;
    const wind = Math.round((weatherData.windspeed || 0) * 10) / 10;
    const humidity = Math.round(weatherData.relative_humidity_2m || 50);
    
    const langRules = ALERT_RULES[language] || ALERT_RULES['en'];
    const threatRules = langRules[threat] || langRules['clear'];
    
    const rule = threatRules[inventoryType] || threatRules['Produce'] || ["MEDIUM", "Monitor weather conditions."];
    
    const alertText = rule[1]
        .replace('{temp}', temp)
        .replace('{wind}', wind)
        .replace('{humidity}', humidity)
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

        // Updated to grab heat and humidity metrics
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&hourly=precipitation_probability,weathercode,temperature_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch from OpenMeteo');
        }
        
        const data = await response.json();
        
        // Map the new current object to match the expected python structure
        const weather_data = {
            temperature: data.current?.temperature_2m || 25,
            windspeed: data.current?.wind_speed_10m || 0,
            winddirection: data.current?.wind_direction_10m || 0,
            weathercode: data.current?.weather_code || 0,
            relative_humidity_2m: data.current?.relative_humidity_2m || 50,
            apparent_temperature: data.current?.apparent_temperature || 25
        };
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
