import json
from deep_translator import GoogleTranslator
import pathlib
import time

english_rules = {
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
        "Electronics": ["HIGH",   "Thunderstorm arriving. Pack valuable electronics into dry boxes. Disconnect street power lines."],
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
}

languages = {
    'hi': 'hi',
    'ta': 'ta',
    'te': 'te',
    'bn': 'bn',
    'mr': 'mr',
    'kn': 'kn',
    'gu': 'gu',
    'ml': 'ml'
}

all_rules = {"en": english_rules}

for lang_code in languages.values():
    print(f"Translating to {lang_code}...")
    lang_rules = {}
    translator = GoogleTranslator(source='en', target=lang_code)
    
    for weather, inventories in english_rules.items():
        lang_rules[weather] = {}
        for inv, data in inventories.items():
            level = data[0]
            text = data[1]
            
            text = text.replace('{temp}', 'TEMP_PLACEHOLDER')
            text = text.replace('{wind}', 'WIND_PLACEHOLDER')
            text = text.replace('{humidity}', 'HUMIDITY_PLACEHOLDER')
            
            try:
                translated = translator.translate(text)
                time.sleep(0.05)
            except Exception as e:
                print(f"Error translating: {e}")
                translated = text

            translated = translated.replace('TEMP_PLACEHOLDER', '{temp}')
            translated = translated.replace('WIND_PLACEHOLDER', '{wind}')
            translated = translated.replace('HUMIDITY_PLACEHOLDER', '{humidity}')
            
            # also handle cases where translator breaks case or spacing
            translated = translated.replace('temp_placeholder', '{temp}').replace('TEMP_placeholder', '{temp}').replace('TEMP _PLACEHOLDER', '{temp}').replace('temp _placeholder', '{temp}')
            translated = translated.replace('wind_placeholder', '{wind}').replace('WIND_placeholder', '{wind}')
            translated = translated.replace('humidity_placeholder', '{humidity}').replace('HUMIDITY_placeholder', '{humidity}')

            lang_rules[weather][inv] = [level, translated]
    all_rules[lang_code] = lang_rules

route_path = 'src/app/api/analyze/route.js'
content = pathlib.Path(route_path).read_text(encoding='utf-8')

rules_json = json.dumps(all_rules, ensure_ascii=False, indent=4)

start_idx = content.find('const ALERT_RULES = {')
end_idx = content.find('const STORM_CODES =')

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + 'const ALERT_RULES = ' + rules_json + ';\n\n' + content[end_idx:]
    pathlib.Path(route_path).write_text(new_content, encoding='utf-8')
    print("Successfully updated route.js translations!")
else:
    print("Could not find replacement points in route.js")
    
pathlib.Path(__file__).unlink()
