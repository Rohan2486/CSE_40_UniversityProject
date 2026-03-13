# BreedVision AI

BreedVision AI is a full-stack animal breed classification platform for cattle and buffalo. It combines a React frontend, Supabase auth and edge functions, optional CNN inference, and multimodal LLM fallbacks to deliver upload-based and live-camera breed analysis with saved history.

## What the project does

- Authenticated users can sign up, log in, classify animals, and review their classification history.
- Users can upload an image or capture one from a live camera workflow.
- Each classification can include breed, animal type, confidence, traits, recommendations, and extended breed information.
- Results can be enriched using synced dataset labels and dataset-derived feature vectors.
- A public in-app documentation page renders this README at `/documentation`.

## Core capabilities

- Supabase Auth with protected routes
- Image upload classification
- Live camera capture and analysis
- Per-user classification history
- Realtime scan count updates
- CNN inference integration
- OpenAI and Gemini vision fallback support
- Dataset sync through JSON or CSV
- Dataset image matching and feature-vector similarity
- Extra breed profile generation
- Animated React UI built with Tailwind and shadcn/ui

## Architecture

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Framer Motion
- TanStack Query
- React Router

### Backend and storage

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Edge Functions

### AI inference stack

- Optional CNN inference service at `services/cnn-inference`
- OpenAI vision fallback
- Gemini vision fallback
- Dataset-aware breed matching
- Feature-vector assisted similarity matching

## Routes

### Public routes

- `/login`
- `/signup`
- `/privacy`
- `/terms`
- `/documentation`
- `*` not found page

### Protected route

- `/`

The home experience includes these main sections:

- Upload
- Live Detection
- History

## How classification works

The main pipeline lives in `supabase/functions/classify-animal/index.ts`.

### High-level flow

1. The frontend captures or uploads an image and sends a data URL to the `classify-animal` edge function.
2. Computer-vision quality metrics and warnings are passed along with the image.
3. The edge function loads known breeds from the synced dataset or falls back to built-in breed lists.
4. Inference runs with CNN support and LLM support depending on mode and availability.
5. The response is merged with dataset matching logic, including exact image matching and feature-vector similarity where available.
6. Extra breed information is generated or normalized.
7. The frontend stores the result in Supabase history and optionally uploads the original image to Supabase Storage.

### Inference modes currently used

- `llm_only`: the frontend currently sends this by default for classification requests
- `auto`: edge function can run CNN and LLM in parallel and merge or compare results

### Providers

- `cnn`
- `llm`
- `fallback`

### Returned result shape

Typical responses can include:

- `type`
- `breed`
- `confidence`
- `modelConfidence`
- `traits`
- `recommendations`
- `provider`
- `extraInfo`
- `accuracyReports`

## Dataset-aware intelligence

BreedVision AI is not just a plain classifier. It can use synced datasets to improve outputs.

### Supported dataset features

- Upload dataset records as JSON or CSV
- Store dataset metadata
- Store arbitrary source record payloads
- Add image URLs to dataset entries
- Generate or persist feature vectors per dataset record
- Use dataset labels as the effective breed vocabulary for classification

### Feature vectors

Both `classify-animal` and `sync-dataset` use simple histogram-based feature vectors with 32 bins. These vectors are used to support image-level matching and similarity checks when dataset images are available.

### Dataset helper script

The repo includes `scripts/backfill-dataset-images.mjs` to backfill dataset record `image_url` values from Storage object names and optionally generate missing feature vectors.

Example dry run:

```bash
node scripts/backfill-dataset-images.mjs
```

Apply updates:

```bash
node scripts/backfill-dataset-images.mjs --apply
```

Limit to one dataset:

```bash
node scripts/backfill-dataset-images.mjs --dataset indian_breeds_v1 --apply
```

## Repository structure

```text
.
|-- services/
|   `-- cnn-inference/          Optional Python CNN microservice
|-- scripts/
|   `-- backfill-dataset-images.mjs
|-- src/
|   |-- animations/
|   |-- components/
|   |-- hooks/
|   |-- integrations/
|   |-- lib/
|   |-- pages/
|   `-- utils/
|-- supabase/
|   |-- functions/
|   |-- migrations/
|   `-- config.toml
|-- ANIMATIONS.md
`-- README.md
```

## Frontend setup

### Requirements

- Node.js 18 or newer recommended
- npm

### Install dependencies

```bash
npm install
```

### Start local development

```bash
npm run dev
```

Vite usually starts on port `8080`, but it may automatically move to another port if needed.

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Run tests

```bash
npm run test
```

### Lint

```bash
npm run lint
```

## Environment variables

Create a root `.env` file for local development. Keep real secrets only in local env files or secret managers.

### Frontend variables

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

### Local scripts and service access

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATASET_IMAGE_BUCKET=classification-images
```

### `classify-animal` edge function secrets

```bash
PROJECT_URL=https://your-project.supabase.co
SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
OPENAI_MODEL=gpt-4o-mini
GEMINI_MODEL=gemini-2.5-flash
CNN_INFERENCE_URL=https://your-cnn-service/predict
CNN_INFERENCE_API_KEY=optional_cnn_api_key
CNN_MIN_CONFIDENCE=45
CNN_TIMEOUT_MS=7000
DATASET_CACHE_TTL_MS=300000
DATASET_IMAGE_BUCKET=classification-images
```

### Notes

- The frontend uses `VITE_SUPABASE_PUBLISHABLE_KEY` for browser requests.
- Supabase Edge Functions should use service credentials from secret storage, not from committed files.
- `PROJECT_URL` and `SERVICE_ROLE_KEY` are the preferred secret names for edge functions.

## Supabase local and cloud setup

### Config in repo

`supabase/config.toml` currently enables:

- email signup
- email confirmation

### Suggested startup flow

1. Create a Supabase project.
2. Add the frontend environment variables locally.
3. Apply the SQL migrations.
4. Deploy the edge functions.
5. Set edge-function secrets.
6. Create or sync dataset records.
7. Configure the storage bucket used for classification images.

### Supabase secrets

Because Supabase CLI has naming restrictions around some `SUPABASE_*` names, this project supports these secret names:

```bash
supabase secrets set PROJECT_URL="https://your-project.supabase.co"
supabase secrets set SERVICE_ROLE_KEY="your_service_role_key"
supabase secrets set OPENAI_API_KEY="your_openai_key"
supabase secrets set GEMINI_API_KEY="your_gemini_key"
supabase secrets set CNN_INFERENCE_URL="https://your-cnn-service/predict"
supabase secrets set CNN_INFERENCE_API_KEY="optional_cnn_api_key"
supabase secrets set CNN_MIN_CONFIDENCE="45"
supabase secrets set CNN_TIMEOUT_MS="7000"
supabase secrets set DATASET_IMAGE_BUCKET="classification-images"
```

### Deploy edge functions

```bash
supabase functions deploy classify-animal
supabase functions deploy save-classification
supabase functions deploy get-stats
supabase functions deploy sync-dataset
supabase functions deploy speak-extra-info
```

## Database and storage

This repo includes migrations for:

- `breeds`
- `breed_traits`
- `datasets`
- `dataset_records`
- `classifications`
- user-related tables
- dataset feature-vector support

Storage bucket used by the app:

- `classification-images`

The frontend uploads classified images to this bucket and stores the public URL in classification history when possible.

## Edge functions

### `classify-animal`

Main classification endpoint.

Responsibilities:

- validate input image data
- normalize CV metrics and warnings
- load dataset labels
- run CNN and/or LLM inference
- perform dataset-aware breed matching
- use feature vectors for image similarity support
- generate extra breed information
- return structured classification output

### `save-classification`

Stores user classification results.

### `get-stats`

Returns statistics for the application.

### `sync-dataset`

Upserts dataset metadata, replaces dataset records, and optionally computes feature vectors from image URLs.

Accepted input modes:

- `records[]` JSON payload
- CSV string payload

JSON example:

```json
{
  "dataset_name": "indian_breeds_v1",
  "source": "manual",
  "meta": { "notes": "optional" },
  "records": [
    { "breed": "Gir", "type": "cattle", "image_url": "https://..." },
    { "breed": "Murrah", "type": "buffalo", "image_url": "https://..." }
  ]
}
```

CSV example:

```json
{
  "dataset_name": "indian_breeds_v1",
  "format": "csv",
  "csv": "breed,type,image_url\nGir,cattle,https://example.com/gir.jpg\nMurrah,buffalo,https://example.com/murrah.jpg\n"
}
```

### `speak-extra-info`

Speech-oriented function for extra animal information. It expects an OpenAI API key if TTS is enabled.

## CNN inference service

The optional Python service under `services/cnn-inference` exposes a `POST /predict` endpoint for the Supabase classifier.

### What it expects

- an ONNX model file
- a label map file
- optional API key protection

### Important limitation

The repo does not ship the actual trained model or label map. You need to provide:

```text
services/cnn-inference/models/breed_cnn.onnx
services/cnn-inference/models/labels.json
```

### Local run

```bash
cd services/cnn-inference
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

PowerShell helper from the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-inference.ps1
```

Then point the edge function to:

```bash
CNN_INFERENCE_URL=http://localhost:8001/predict
```

### Health check

```bash
curl http://localhost:8001/health
```

If the model is missing, the service can still run but will report that the model is not ready and return unknown predictions so the edge function can fall back.

## Authentication flow

- Signup uses Supabase email/password auth
- Email confirmation is enabled
- Login and signup pages are public-only
- The home page is route-protected
- Sign-out is handled in the frontend through Supabase Auth

### Supabase auth dashboard reminders

Add your local and deployed URLs to:

- Site URL
- Redirect URLs

Examples:

- `http://localhost:8080`
- `http://localhost:8080/login`

Use the exact port your local Vite server is running on.

## UI notes

- The app uses lazy-loaded routes and components for smoother navigation.
- Framer Motion powers page transitions and animated sections.
- `ANIMATIONS.md` documents the animation layer and supporting hooks/components.
- The documentation page renders this README directly so documentation stays aligned with the codebase.

## API usage from the frontend

The frontend calls the edge function directly:

```text
POST {VITE_SUPABASE_URL}/functions/v1/classify-animal
```

Headers include:

- `Content-Type: application/json`
- `Authorization: Bearer {VITE_SUPABASE_PUBLISHABLE_KEY}`

After classification, the frontend attempts to:

1. upload the original image to Supabase Storage
2. save the classification through `save-classification`
3. fall back to direct table insertion if saving through the function fails

## Secret safety

Do not commit real secrets to GitHub.

### Ignored by `.gitignore`

- `.env`
- `.env.*`
- `*.env`
- local virtual environments
- Supabase local state folders
- common cache folders and build outputs

### Safe practice

- Keep real values only in local `.env` files or deployment secret managers.
- Commit only placeholders and examples.
- Never hardcode service role keys, OpenAI keys, Gemini keys, or personal access tokens.
- If a secret is ever committed, rotate it immediately.

### Quick checks before pushing

```bash
git status --short --ignored
git ls-files | rg "\.env($|\.)"
rg -n --hidden --glob '!*.env' --glob '!.git/*' "OPENAI_API_KEY|GEMINI_API_KEY|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|ghp_|github_pat_|sk-" .
```

## Known limitations

- The bundled CNN service is only fully useful after you add trained model artifacts.
- Camera access depends on browser permissions and usually requires `localhost` or HTTPS.
- Public URL storage is convenient for demos, but private-storage strategies may be better for sensitive deployments.
- Classification quality depends heavily on image clarity, angle, lighting, and dataset quality.

## Development notes

- The project includes Vitest test setup.
- The app uses TypeScript path aliases and Vite-based development.
- The repo includes both frontend and backend logic, so keep environment separation clear when deploying.

## Mobile app with Expo Go

This repo now also includes a separate Expo client in `mobile/` so you can ship both:

- the existing Vite web app
- a React Native mobile app for Expo Go

### What the Expo app reuses

- Supabase Auth
- Supabase Storage
- Supabase `classifications` table
- `classify-animal` edge function
- `save-classification` edge function
- the same Supabase project and publishable key

### What the Expo app currently includes

- email/password login and signup
- image upload from the photo library
- camera capture with Expo Camera
- classification result display
- history view backed by the shared database
- storage upload before saving classification records

### Mobile environment variables

Create `mobile/.env` from `mobile/.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

### Run the mobile app

```bash
cd mobile
npm install
npx expo start
```

Then scan the QR code with Expo Go on your device.

### Run web and mobile together

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
cd mobile
npx expo start
```

Both clients can talk to the same Supabase backend at the same time.

## Contact

For academic or project contact:

`ROHAN.20221CSE0009@PresidencyUniversity.in`
