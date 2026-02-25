# CNN Inference Service (Starter)

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
