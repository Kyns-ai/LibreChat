FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 wget curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /requirements.txt
# Install PyTorch with CUDA 12.1 support, then other dependencies
RUN pip install --no-cache-dir \
    torch==2.3.1+cu121 torchvision==0.18.1+cu121 \
    --index-url https://download.pytorch.org/whl/cu121 \
    && pip install --no-cache-dir -r /requirements.txt

COPY handler.py /handler.py

ENV VOLUME_PATH=/runpod-volume
ENV HF_HOME=/runpod-volume/hf-cache
ENV TRANSFORMERS_CACHE=/runpod-volume/hf-cache
ENV LUSTIFY_MODEL=lustify_model.safetensors
ENV ZIMAGE_MODEL=zimage_model.safetensors

CMD ["python3", "/handler.py"]
