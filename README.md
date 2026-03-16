# 🌿 Project Canopy

> Early-warning weather risk intelligence for street vendors and small outdoor businesses.

Built for the **Amazon Nova AI Hackathon** — *Multimodal Understanding Track*.

---

## The Problem

Street vendors operate entirely at the mercy of the weather. A sudden storm, unexpected wind shear, or an hour of heavy rain can destroy a day's inventory. More chronically, extreme heatwaves and oppressive humidity destroy fresh produce, melt plastics, and create life-threatening conditions. Their delicate means of earning a livelihood often puts them in terribly unfortunate positions of financial pressure. These vendors rarely have the technical literacy or device access to parse a NOAA forecast, let alone assess the specific risk their inventory possibly faces.

Weather apps tell you *what's coming*. They don't tell a vegetable vendor in Jaipur whether to pack up his stall right now.

Canopy bridges that gap.

---

## What It Does

Canopy is a **Progressive Web App** that gives street vendors a fast, hyperlocal weather risk assessment tailored to their specific inventory type.

A vendor taps **"Enable Alerts & Analyze"**, and within seconds they get:

- **A live radar-style heatmap** built from NOAA HRRR temperature data at their exact coordinates.
- **An AI-generated risk assessment** from Amazon Nova 2 Lite — not generic weather advice, but *inventory-specific* reasoning. A produce vendor gets different guidance than an electronics seller.
- **An urgency level** and two concrete mitigation steps, delivered in their regional language.
- **A pinnable PWA** — home screen installable, push-capable, works on smoothly even on low to mid-range Android devices.

---

## Architecture

The full intended system has three distinct layers, each with a clear responsibility.

```
[Vendor's Phone]
      │
      ▼
[Next.js PWA Frontend]
  - Inventory selector
  - Geolocation + Push subscription
  - Risk Prediction Clock
  - 9-language AI response rendering
      │
      ▼
[FastAPI Backend / AWS Lambda]
      │
      ├──► NOAA HRRR (AWS Open Data, Zarr)
      │         └── Surface Temp slice → PNG heatmap
      │
      ├──► AWS Bedrock: Nova Multimodal Embeddings
      │         └── Radar image → embedding vector
      │                   └── Cosine similarity → historical extreme weather retrieval
      │
      ├──► Open-Meteo API
      │         └── Current weather JSON at coordinates
      │
      └──► AWS Bedrock: Nova 2 Lite (Converse API)
                └── Multimodal prompt: inventory + weather + historical context + radar image
                          └── JSON response: urgency_level + mitigation_alert
```

### Frontend — Next.js PWA

Built with the Next.js App Router. A single-page dashboard handles inventory selection, geolocation, push subscription, and response rendering.

PWA infrastructure uses `next-pwa` with a custom `manifest.json` and a Workbox-powered `sw.js` for smart caching and offline behavior. The push subscription flow uses the standard `PushManager` API with VAPID keys, sending the vendor's coordinates and inventory type to the backend analyze endpoint.

### Backend — FastAPI + AWS

`local_server.py` exposes `POST /api/analyze` and orchestrates the full pipeline. The weather and GIS logic lives in `hrrr_lambda.py`, written to be deployable either as a standalone AWS Lambda or as importable functions.

**HRRR data pipeline:**
- Uses `s3fs` + `xarray` to read NOAA HRRR Zarr data directly from `s3://hrrrzarr/` via anonymous AWS Open Data access.
- Extracts a 2D slice of surface temperature (`TMP_surface`) centered on the vendor's location.
- Renders the slice as a PNG heatmap via Matplotlib using the `inferno` colormap.

**Visual RAG pipeline (Core Technology Demo):**
- The radar PNG is embedded using **Amazon Nova Multimodal Embeddings** (`amazon.nova-2-multimodal-embeddings-v1:0`) via AWS Bedrock Runtime.
- **The Historical Weather Database:** We constructed `historical_vectors.json`, a concrete vector storage map matching historical extreme weather events from the Indian Meteorological Department (IMD) to multimodal embeddings. For example, it encodes events like:
  - **IMD_HW_2015_AP_TS**: 2015 Andhra Pradesh Heatwave (Mitigation: soaking jute bags)
  - **IMD_HW_2022_NW**: 2022 Northwest Dry Heat Dome (Mitigation: double-layered reflective tarps)
  - **IMD_HW_2023_UP_BIHAR**: 2023 UP/Bihar Humid Heatwave (Mitigation: blocking open-air meat cuts/fruit)
- The resulting vector is compared against these precomputed historical radar embeddings stored in `historical_vectors.json`. Using cosine similarity, the system retrieves the most analogous past heatwave or storm scenario, grounding the AI in actual documented mitigation strategies.
- This retrieved context is passed downstream to the reasoning layer.

**Reasoning layer (`bedrock_nova.py`):**
- Calls **Amazon Nova 2 Lite** (`amazon.nova-2-lite-v1:0`) via the Bedrock Converse API.
- The multimodal prompt contains: inventory type, current weather JSON, retrieved historical impact description, and the current radar PNG.
- Nova 2 Lite returns a strict JSON payload: `urgency_level` + `mitigation_alert`. FastAPI passes this directly to the frontend.

**Push notification infrastructure (production-ready):**
- A Lambda function saves push subscriptions to DynamoDB.
- A separate `push_lambda.py` fans out Web Push notifications to all subscribers, wired via AWS SAM.
- Fully ready for deployment once live Bedrock access propagates.

---

## Demo Resilience — The Hackathon Reality

This section is worth being transparent about.

Building on AWS Bedrock in a hackathon introduces a hard constraint: AWS Bedrock constraints. Vercel's serverless functions have a 250MB deployment limit, which breaks Python data science packages like `xarray` and `zarr`. We had the architecture, we had the code, but we couldn't guarantee it would be live for judges.

So we engineered around it.

### Edge API Fallback

We built a **Next.js Edge API route (`/api/analyze/route.js`)** that runs entirely at the edge, outside Vercel's Python size constraints. When the full AWS pipeline is unavailable, the app automatically falls back to a deterministic rule-engine built on Open-Meteo data.

The fallback isn't a stub — it produces real, inventory-specific guidance using structured weather variables (wind speed, precipitation probability, temperature deltas). The transition between the full pipeline and the fallback is seamless to the user.

### 9-Language Localization

One of the most important features — and one we almost cut — is full Indic language support. The AI response, urgency level, weather labels, and UI copy are all translated across:

**Hindi, Tamil, Telugu, Bengali, Marathi, Kannada, Gujarati, Malayalam, and English**

This is handled via a comprehensive localization dictionary mapping weather events and risk concepts into each language. The `SafeWindowClock` SVG component even dynamically translates its own labels. A street vendor in Tamil Nadu shouldn't have to read their risk assessment in English.

### Custom TTS Audio Streaming

Native Android `window.speechSynthesis` doesn't reliably handle Indic script. On most mid-range devices it either silently fails or produces garbled output.

We fixed this by building a **server-side TTS proxy (`/api/tts/route.js`)** that fetches audio buffers from Google TTS and pipes them back to the client through a hidden HTML5 `<audio>` element. This bypasses mobile browser restrictions entirely and works consistently across devices.

### Graceful Push API Handling

Strict Chrome VAPID validation was crashing the app on certain Android configurations. We wrapped the entire push subscription flow in `DOMException` error boundaries — if the device rejects the subscription for any reason, the core app experience continues without interruption. The alert functionality degrades gracefully; the risk assessment always works.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, Tailwind CSS |
| PWA | next-pwa, Workbox, Web Push API |
| Backend | Python, FastAPI |
| Weather Data | NOAA HRRR Zarr (AWS Open Data), Open-Meteo |
| AI — Embeddings | Amazon Nova Multimodal Embeddings (AWS Bedrock) |
| AI — Reasoning | Amazon Nova 2 Lite (AWS Bedrock, Converse API) |
| Vector Search | Cosine similarity over precomputed historical embeddings |
| Push Infrastructure | AWS Lambda, DynamoDB, AWS SAM |
| Edge Fallback | Next.js Edge Runtime |
| TTS | Server-side Google TTS proxy |
| Deployment | Vercel (frontend), AWS Lambda (backend) |

---

## Amazon Nova — How We Used It

Amazon Nova is central to what makes Canopy more than a weather widget.

**Nova Multimodal Embeddings** converts a radar heatmap image into a vector that captures the *structure* of the heat pattern or weather event — not just metadata. This lets us do visual similarity search against historical Indian weather events (like the 2015 Andhra-Telangana Heatwave), grounding the AI's advice in real historical mitigation tactics (e.g. adopting early morning operating hours and soaking jute bags) rather than generic weather knowledge.

**Nova 2 Lite** reasons over a genuinely multimodal input: a PNG image of the current radar, a JSON payload of live weather variables, retrieved historical context, and the vendor's specific inventory type. The output is not a weather summary — it's a risk decision with urgency and actionable steps, specific to what that vendor is selling today.

The combination — visual retrieval feeding a multimodal reasoner — is what we're calling a **Visual RAG pipeline**. It's the architectural idea we're most proud of in this project.

---

## Objectives

- Deliver actionable, inventory-specific weather risk assessments to vendors with low technical literacy.
- Use state-of-the-art multimodal AI (Amazon Nova) in a way that meaningfully improves the output over a rule-based system.
- Seamlessly work on low to mid-range Android devices in Indian market conditions.
- Be installable, push-capable, and usable offline.
- Support regional languages without requiring the vendor to configure anything.

---


## What We Learned

The HRRR Zarr pipeline was harder than expected — reading partial chunks from a remote Zarr store over anonymous S3 efficiently requires understanding xarray's lazy loading model in ways the documentation doesn't make obvious.

The 9-language TTS problem turned out to be the most genuinely interesting engineering challenge of the weekend. Indic text on Android is a surprisingly unsolved UX problem in the web ecosystem, and the server-side audio proxy is a pattern we hadn't seen documented anywhere.

And honestly — building a fallback system that's as good as your primary system is harder than just building the primary system. The Edge fallback forced us to think clearly about what the AI pipeline was actually adding, and make sure that value was expressible in deterministic logic too.

---

*Built for the Amazon Nova AI Hackathon.*