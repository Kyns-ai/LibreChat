# KYNS Image Generation Worker for RunPod Serverless
# GPU: A40 (48GB VRAM) — fits both Lustify v7 (~7GB fp16) + Z-Image Turbo (~7GB fp16)
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install Python dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy handler
COPY handler.py .

# Default env vars (override via RunPod endpoint environment variables)
ENV VOLUME_PATH=/runpod-volume
ENV LUSTIFY_MODEL=lustifySDXLNSFW_ggwpV7.safetensors
ENV ZIMAGE_MODEL=zImageTurbo_v1.safetensors

CMD ["python", "-u", "handler.py"]
