# BreedVision AI (BreedAI)

AI-powered cattle and buffalo breed classification with image upload and live camera detection. Built with React + Vite, Tailwind, and Supabase edge functions.

## Features
- Auth flow with Supabase (`/login`, `/signup`) and protected home route
- Sign out action from the home header
- Image upload classification with confidence scoring
- Live camera detection and snapshot analysis
- Per-user classification history (saved and restored on next login)
- Modern UI with motion effects and glassmorphism styling
- Privacy and Terms pages

## Tech Stack
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Framer Motion
- Supabase (edge function for classification)
- React Router

## AI Algorithms Used
1. CNN-based image classification (primary)
   - A custom CNN inference service predicts animal `type`, `breed`, and base model confidence from images.

2. Multimodal LLM vision fallback (secondary)
   - If CNN is unavailable, low-confidence, or returns unknown, fallback runs:
     - OpenAI vision model (`OPENAI_MODEL`, default `gpt-4o-mini`)
     - then Gemini vision model (`GEMINI_MODEL`, default `gemini-2.5-flash`)

3. Confidence calibration algorithm (post-processing)
   - Final confidence is calibrated using:
     - model confidence
     - image quality score (brightness, contrast, sharpness, resolution)
     - trait reliability score
     - penalties for warnings and uncertainty indicators (low margin, high entropy)

4. Dataset-aware label matching
   - Predicted breeds are validated against synced dataset labels using:
     - exact label matching
     - fuzzy matching (Levenshtein similarity)
   - Confidence is adjusted based on match quality.

## Pages and Routes
- `/login` Login page (public-only; authenticated users redirect to `/`)
- `/signup` Signup page (public-only; authenticated users redirect to `/`)
- `/` Home, hero, and tabs (protected; unauthenticated users redirect to `/login`)
- `/privacy` Privacy Policy
- `/terms` Terms of Service

Tabs on the home page:
- Upload
- Live Detection
- History

## Getting Started

Install dependencies:
```bash
npm install
```

Run the dev server:
```bash
npm run dev
```
Default dev port is `8080`.  
If port `8080` is busy, Vite automatically switches (for example `8081`) and prints the URL in terminal.

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

Run tests:
```bash
npm run test
```

## Environment Variables
Create a `.env` file at the project root with:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

For `supabase/functions/classify-animal` provider routing:
```bash
CNN_INFERENCE_URL=https://your-cnn-service/predict
CNN_INFERENCE_API_KEY=optional_cnn_api_key
CNN_MIN_CONFIDENCE=45
CNN_TIMEOUT_MS=7000
```

UI calls:
- `POST {VITE_SUPABASE_URL}/functions/v1/classify-animal`

## GitHub and Secrets Safety
- Never commit real secrets to the repository (`.env`, service role keys, API keys, access tokens).
- This project ignores secret/local files through `.gitignore`:
  - `.env`, `.env.*`, `*.env` (except example files)
  - local virtualenv folders and caches
  - Supabase local state folders (`supabase/.temp`, `supabase/.branches`)
- Keep only placeholder/example values in tracked files (for example, `.env.example`).

Before pushing, verify no secrets are staged:
```bash
git status --short --ignored
git ls-files | rg "\\.env($|\\.)"
```

If a secret was already committed, rotate that secret immediately and rewrite Git history before sharing the repo.

## Supabase Schema
Included migrations create the following tables:
- `breeds`
- `breed_traits`
- `datasets`
- `dataset_records`
- `classifications`

Storage bucket:
- `classification-images` (public read)

`classifications.user_id` is used to scope records by authenticated user in the app.

## Dataset Sync (JSON or CSV)
Edge function: `sync-dataset`

JSON body example:
```json
{
  "dataset_name": "indian_breeds_v1",
  "source": "manual",
  "meta": { "notes": "optional" },
  "records": [
    { "breed": "Gir", "type": "cattle" },
    { "breed": "Murrah", "type": "buffalo" }
  ]
}
```

CSV body example:
```json
{
  "dataset_name": "indian_breeds_v1",
  "format": "csv",
  "csv": "breed,type\nGir,cattle\nMurrah,buffalo\n"
}
```

## Edge Functions
- `classify-animal` (CNN-first inference with LLM fallback and confidence calibration)
- `sync-dataset` (dataset upload, JSON/CSV)
- `get-stats` (counts for UI stats)
- `save-classification` (store history)

## Main Algorithm (Project + Confidence)
The core pipeline is implemented in `supabase/functions/classify-animal/index.ts`.

High-level flow:
1. Validate image data URL and normalize CV metrics (`brightness`, `contrast`, `sharpness`, `width`, `height`).
2. Load known breed labels from synced dataset tables (`dataset_records`, `breeds`) or built-in fallback labels.
3. In `auto` mode:
   - Try CNN inference first.
   - If result is unknown/low confidence, run LLM vision fallback (OpenAI first, then Gemini).
4. Enforce dataset-aware breed matching (exact/fuzzy/no-match) and adjust confidence.
5. Return final classification + `accuracyReports` + practical `extraInfo`.

### Confidence Calibration Formula
Final confidence is not just model output. It is calibrated using image quality and trait reliability:

```text
blended = 0.68 * modelConfidence
        + 0.22 * qualityScore
        + 0.10 * traitReliabilityScore

warningPenalty = min(20, 3 * warningCount)
marginPenalty = 7   (if low-margin CNN logits)
entropyPenalty = 6  (if high normalized entropy)

finalConfidence = clamp( round(blended - warningPenalty - marginPenalty - entropyPenalty), 0, 100 )
```

Where:
- `qualityScore` (0..100) is computed from:
  - brightness closeness to 128 (30%)
  - contrast normalized by 64 (25%)
  - sharpness normalized by 60 (30%)
  - min image dimension normalized by 1024 (15%)
- `traitReliabilityScore` (0..100) combines:
  - ratio of available (non-`Unavailable`) traits (70%)
  - mean trait score normalized to 0..1 (30%)

### Dataset-Match Confidence Adjustment
After calibration, confidence is adjusted using synced dataset labels:
- Exact label match: `+4` confidence (capped at 100)
- Fuzzy match (Levenshtein similarity >= 0.82): multiply confidence by `0.94`
- Type mismatch vs dataset label: `-5`
- No dataset match: breed becomes `Unknown`, confidence capped to `35`

### Decision Threshold
- `CNN_MIN_CONFIDENCE` default is `45`.
- If final confidence is below threshold, the API appends a low-confidence recommendation.
- In `auto` mode, low-confidence or unknown CNN results trigger LLM fallback.

## CNN Service (Starter)
A starter CNN inference service is included at `services/cnn-inference`.

Run locally:
```bash
cd services/cnn-inference
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Or from repo root (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File .\start-inference.ps1
```

Then set:
```bash
CNN_INFERENCE_URL=http://localhost:8001/predict
```

Service docs: `services/cnn-inference/README.md`

## Supabase Secrets (CLI)
Supabase CLI doesn't allow secrets starting with `SUPABASE_`. Use:
```bash
supabase secrets set PROJECT_URL="https://your-project.supabase.co"
supabase secrets set SERVICE_ROLE_KEY="your_service_role_key"
supabase secrets set OPENAI_API_KEY="your_openai_key"
```

## Project Structure
- `src/components` UI and feature components
- `src/pages` Route pages
- `src/assets` Static images (hero)
- `src/index.css` Tailwind and theme tokens

## Auth and Email Notes
- Signup uses Supabase Auth `signUp()` with email confirmation redirect to `/login`.
- Resend confirmation uses Supabase Auth `resend({ type: "signup" })`.
- If using default Supabase mailer (no custom SMTP), delivery can be rate-limited/delayed.
- Make sure Supabase Auth settings include your current local URL in:
  - Site URL (for example `http://localhost:8081`)
  - Redirect URLs (for example `http://localhost:8081/login`)

## Notes
- Live camera requires HTTPS or `localhost` in modern browsers.
- If you want live stats, connect the UI to a real API or Supabase table and update the numbers dynamically.

## Contact
For questions or support:
`ROHAN.20221CSE0009@PresidencyUniversity.in`
