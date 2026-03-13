# CNN Inference Service

This service exposes a `POST /predict` endpoint compatible with `supabase/functions/classify-animal`.

## What it does
- Loads an ONNX CNN model (`CNN_MODEL_PATH`)
- Uses a label map (`CNN_LABEL_MAP_PATH`)
- Returns:
  - `type`
  - `breed`
  - `confidence` (0-100)
  - `traits`
  - `recommendations`

If model or labels are missing, it returns `breed: Unknown` and `confidence: 0` so your edge function can fallback to LLM.

## Important
- This repo does not currently include `models/breed_cnn.onnx` or `models/labels.json`.
- Public deployment will work only after you add those files.
- If you deploy without them, `/health` will show `model_ready: false` and `/predict` will return `Unknown`.

## Expected model output
- The ONNX model output must be logits/probabilities with shape `[num_classes]` or `[1, num_classes]`.
- `labels.json` must map class index to breed string:
```json
["Gir", "Sahiwal", "Murrah"]
```
or
```json
{"0": "Gir", "1": "Sahiwal", "2": "Murrah"}
```

## Setup
1. Create and activate a Python virtual environment.
2. Install dependencies:
```bash
pip install -r requirements.txt
```
3. Copy `.env.example` to `.env` and update paths/secrets.
4. Place model and labels in `./models/`.

## Run
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Deploy publicly
This container is ready for platforms like Cloud Run, Render, Railway, or Fly.io.

### Required files before deploy
Add these inside `services/cnn-inference/models/`:
```text
breed_cnn.onnx
labels.json
```

### Expected container behavior
- listens on `0.0.0.0`
- uses `PORT` env var when provided by the host
- exposes:
  - `GET /health`
  - `POST /predict`

### Cloud Run example
From `services/cnn-inference`:
```bash
gcloud run deploy breedvision-cnn \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated
```

After deploy, set the returned URL in Supabase:
```bash
supabase secrets set CNN_INFERENCE_URL="https://YOUR-CLOUD-RUN-URL/predict"
supabase secrets set CNN_INFERENCE_API_KEY="your_optional_key"
supabase functions deploy classify-animal
```

### Render example
- Create a new Web Service from `services/cnn-inference`
- Environment:
  - `PORT=10000` or leave Render default
  - `CNN_MODEL_PATH=/app/models/breed_cnn.onnx`
  - `CNN_LABEL_MAP_PATH=/app/models/labels.json`
  - `CNN_INFERENCE_API_KEY=<optional>`
- Start command:
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Health check
```bash
curl http://localhost:8001/health
```

## Predict example
```bash
curl -X POST "http://localhost:8001/predict" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CNN_INFERENCE_API_KEY>" \
  -d '{
    "imageData":"data:image/jpeg;base64,...",
    "cvMetrics":{"brightness":120,"contrast":35,"sharpness":28,"width":1024,"height":1024},
    "cvWarnings":["Low contrast image."],
    "knownBreeds":{
      "cattle":["Gir","Sahiwal"],
      "buffalo":["Murrah","Surti"]
    }
  }'
```

## Connect to Supabase edge function
Set these secrets:
```bash
supabase secrets set CNN_INFERENCE_URL="https://your-host/predict"
supabase secrets set CNN_INFERENCE_API_KEY="your_key_if_enabled"
supabase secrets set CNN_MIN_CONFIDENCE="45"
supabase secrets set CNN_TIMEOUT_MS="7000"
```
