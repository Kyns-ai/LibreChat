# KYNS Image Generation Worker for RunPod Serverless
# GPU: A40 (48GB VRAM) — Lustify v7 (SDXL FP16 ~6.5GB) + Z-Image Turbo (DiT BF16 ~12GB)
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install Python deps — diffusers from source for ZImagePipeline support
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py .

# Network volume mount point
ENV VOLUME_PATH=/runpod-volume
# HuggingFace cache on the network volume (persists across workers)
ENV HF_HOME=/runpod-volume/hf-cache
ENV TRANSFORMERS_CACHE=/runpod-volume/hf-cache

ENV LUSTIFY_MODEL=lustifySDXLNSFW_ggwpV7.safetensors

CMD ["python", "-u", "handler.py"]
