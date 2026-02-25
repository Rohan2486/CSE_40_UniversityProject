import base64
import io
import json
import os
from typing import Any, Optional

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, Header, HTTPException
from PIL import Image
from pydantic import BaseModel, Field


class CvMetrics(BaseModel):
    brightness: float = 128.0
    contrast: float = 32.0
    sharpness: float = 30.0
    width: int = 1024
    height: int = 1024


class KnownBreeds(BaseModel):
    cattle: list[str] = Field(default_factory=list)
    buffalo: list[str] = Field(default_factory=list)


class PredictRequest(BaseModel):
    imageData: str
    cvMetrics: Optional[CvMetrics] = None
    cvWarnings: list[str] = Field(default_factory=list)
    knownBreeds: Optional[KnownBreeds] = None


class Trait(BaseModel):
    name: str
    value: str
    score: int


class PredictResponse(BaseModel):
    type: str
    breed: str
    confidence: int
    traits: list[Trait]
    recommendations: str
    model_info: dict[str, Any] = Field(default_factory=dict)


BODY_TRAITS = [
    "Body Length",
    "Height at Withers",
    "Chest Girth",
    "Rump Angle",
    "Udder Attachment",
    "Body Condition",
]

MODEL_PATH = os.getenv("CNN_MODEL_PATH", "./models/breed_cnn.onnx")
LABEL_MAP_PATH = os.getenv("CNN_LABEL_MAP_PATH", "./models/labels.json")
API_KEY = os.getenv("CNN_INFERENCE_API_KEY", "").strip()
INPUT_SIZE = int(os.getenv("CNN_INPUT_SIZE", "224"))
SOFTMAX_TEMPERATURE = float(os.getenv("CNN_SOFTMAX_TEMP", "1.0"))


class CnnRunner:
    def __init__(self) -> None:
        self.session: Optional[ort.InferenceSession] = None
        self.input_name: Optional[str] = None
        self.labels: list[str] = []
        self._load()

    def _load(self) -> None:
        if not os.path.exists(MODEL_PATH):
            return
        providers = ["CPUExecutionProvider"]
        self.session = ort.InferenceSession(MODEL_PATH, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        if os.path.exists(LABEL_MAP_PATH):
            with open(LABEL_MAP_PATH, "r", encoding="utf-8") as f:
                label_data = json.load(f)
            if isinstance(label_data, list):
                self.labels = [str(x) for x in label_data]
            elif isinstance(label_data, dict):
                ordered = sorted(label_data.items(), key=lambda kv: int(kv[0]))
                self.labels = [str(v) for _, v in ordered]

    @property
    def is_ready(self) -> bool:
        return self.session is not None and self.input_name is not None and len(self.labels) > 0

    def infer(self, image: Image.Image) -> tuple[str, float, float, float]:
        if not self.is_ready:
            return "Unknown", 0.0, 0.0, 1.0

        resized = image.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.Resampling.BILINEAR)
        arr = np.asarray(resized, dtype=np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
        chw = np.transpose(arr, (2, 0, 1))[None, ...]

        outputs = self.session.run(None, {self.input_name: chw})  # type: ignore[arg-type]
        logits = np.array(outputs[0]).reshape(-1)
        scaled = logits / max(0.05, SOFTMAX_TEMPERATURE)
        exps = np.exp(scaled - np.max(scaled))
        probs = exps / np.sum(exps)

        class_idx = int(np.argmax(probs))
        confidence = float(probs[class_idx])
        sorted_probs = np.sort(probs)[::-1]
        top2 = float(sorted_probs[1]) if sorted_probs.size > 1 else 0.0
        margin = max(0.0, confidence - top2)
        entropy = float(-np.sum(probs * np.log(np.maximum(probs, 1e-12))))
        normalized_entropy = min(1.0, max(0.0, entropy / np.log(len(probs)))) if len(probs) > 1 else 0.0
        if class_idx >= len(self.labels):
            return "Unknown", 0.0, margin, normalized_entropy
        return self.labels[class_idx], confidence, margin, normalized_entropy


def decode_data_url(data_url: str) -> Image.Image:
    if "," in data_url:
        _, encoded = data_url.split(",", 1)
    else:
        encoded = data_url
    raw = base64.b64decode(encoded)
    return Image.open(io.BytesIO(raw))


def derive_type(breed: str, known_breeds: Optional[KnownBreeds]) -> str:
    if known_breeds is not None:
        if breed in known_breeds.buffalo:
            return "buffalo"
        if breed in known_breeds.cattle:
            return "cattle"
    return "cattle"


def score_to_text(score: float, low: str, mid: str, high: str) -> str:
    if score < 35:
        return low
    if score < 65:
        return mid
    return high


def synthesize_traits(metrics: Optional[CvMetrics]) -> list[Trait]:
    m = metrics or CvMetrics()
    return [
        Trait(name="Body Length", value=score_to_text(m.width, "Compact", "Balanced", "Long frame"), score=6),
        Trait(name="Height at Withers", value=score_to_text(m.height, "Short", "Average", "Tall"), score=6),
        Trait(
            name="Chest Girth",
            value=score_to_text(m.contrast * 2.0, "Narrow appearance", "Moderate width", "Broad build"),
            score=6,
        ),
        Trait(name="Rump Angle", value="Moderate slope", score=6),
        Trait(
            name="Udder Attachment",
            value=score_to_text(m.sharpness * 2.0, "Not clearly visible", "Moderately defined", "Well-defined"),
            score=6,
        ),
        Trait(
            name="Body Condition",
            value=score_to_text(m.brightness, "Low visibility", "Moderate condition", "Good condition cues"),
            score=6,
        ),
    ]


def build_recommendations(confidence: int, warnings: list[str]) -> str:
    quality_note = " ".join(warnings[:2]).strip()
    if confidence >= 75:
        base = "High-confidence CNN prediction. Validate with field records before breeding decisions."
    elif confidence >= 45:
        base = "Moderate-confidence CNN prediction. Capture another angle for confirmation."
    else:
        base = "Low-confidence CNN prediction. Use additional images or fallback model."
    return f"{base} {quality_note}".strip()


def derive_quality_score(metrics: Optional[CvMetrics]) -> int:
    m = metrics or CvMetrics()
    brightness_score = max(0.0, 1.0 - abs(m.brightness - 128.0) / 128.0)
    contrast_score = min(1.0, m.contrast / 64.0)
    sharpness_score = min(1.0, m.sharpness / 60.0)
    resolution_score = min(1.0, min(m.width, m.height) / 1024.0)
    return int(round((brightness_score * 0.30 + contrast_score * 0.25 + sharpness_score * 0.30 + resolution_score * 0.15) * 100))


def calibrate_confidence(
    model_confidence: int,
    quality_score: int,
    warning_count: int,
    margin: float,
    normalized_entropy: float,
) -> int:
    blended = model_confidence * 0.72 + quality_score * 0.22
    warning_penalty = min(18, warning_count * 3)
    low_margin_penalty = 0 if margin >= 0.18 else int(round((0.18 - margin) * 55))
    entropy_penalty = int(round(normalized_entropy * 12))
    calibrated = int(round(blended - warning_penalty - low_margin_penalty - entropy_penalty))
    return max(0, min(100, calibrated))


app = FastAPI(title="BreedVision CNN Inference", version="0.1.0")
runner = CnnRunner()


def authorize(authorization: Optional[str]) -> None:
    if not API_KEY:
        return
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "model_ready": runner.is_ready,
        "model_path": MODEL_PATH,
        "label_count": len(runner.labels),
        "expected_traits": BODY_TRAITS,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest, authorization: Optional[str] = Header(default=None)) -> PredictResponse:
    authorize(authorization)

    try:
        image = decode_data_url(request.imageData)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid imageData: {exc}") from exc

    breed, raw_conf, margin, normalized_entropy = runner.infer(image)
    model_confidence = int(max(0, min(100, round(raw_conf * 100))))
    quality_score = derive_quality_score(request.cvMetrics)
    confidence = calibrate_confidence(
        model_confidence=model_confidence,
        quality_score=quality_score,
        warning_count=len(request.cvWarnings),
        margin=margin,
        normalized_entropy=normalized_entropy,
    )
    animal_type = derive_type(breed, request.knownBreeds)
    traits = synthesize_traits(request.cvMetrics)

    if breed == "Unknown":
        confidence = 0

    return PredictResponse(
        type=animal_type,
        breed=breed,
        confidence=confidence,
        traits=traits,
        recommendations=build_recommendations(confidence, request.cvWarnings),
        model_info={
            "model_ready": runner.is_ready,
            "input_size": INPUT_SIZE,
            "temperature": SOFTMAX_TEMPERATURE,
            "model_confidence": model_confidence,
            "quality_score": quality_score,
            "margin": round(margin, 4),
            "normalized_entropy": round(normalized_entropy, 4),
        },
    )
