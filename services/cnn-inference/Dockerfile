FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY models ./models

ENV CNN_MODEL_PATH=/app/models/breed_cnn.onnx
ENV CNN_LABEL_MAP_PATH=/app/models/labels.json
ENV CNN_INPUT_SIZE=224
ENV CNN_SOFTMAX_TEMP=1.0

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
