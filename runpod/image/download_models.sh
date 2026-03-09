#!/usr/bin/env bash
# Download KYNS image generation models to RunPod network volume.
# Run this ONCE from a RunPod pod that has the network volume mounted at /runpod-volume.
# Usage: bash download_models.sh

set -e

VOLUME_PATH="${VOLUME_PATH:-/runpod-volume}"
MODEL_DIR="$VOLUME_PATH/models/checkpoints"
mkdir -p "$MODEL_DIR"

echo "==> Downloading Lustify v7 SDXL..."
# HuggingFace: John6666/lustify-sdxl-nsfw-checkpoint-ggwp-v7-sdxl
pip install huggingface_hub -q
python3 - << 'PYEOF'
from huggingface_hub import hf_hub_download
import os
out = hf_hub_download(
    repo_id="John6666/lustify-sdxl-nsfw-checkpoint-ggwp-v7-sdxl",
    filename="lustifySDXLNSFW_ggwpV7.safetensors",
    local_dir=os.environ.get("MODEL_DIR", "/runpod-volume/models/checkpoints"),
    local_dir_use_symlinks=False,
)
print(f"Lustify saved to {out}")
PYEOF

echo ""
echo "==> Downloading Z-Image Turbo SDXL..."
# Replace with the correct HuggingFace repo / CivitAI download for your Z-Image Turbo checkpoint.
# If using CivitAI, set CIVITAI_TOKEN env var and uncomment the curl command below.
# OPTION A — HuggingFace (update repo_id and filename as needed):
python3 - << 'PYEOF'
from huggingface_hub import hf_hub_download
import os
# TODO: Update repo_id and filename when you know the exact HuggingFace location of Z-Image Turbo
# out = hf_hub_download(
#     repo_id="REPLACE_WITH_REPO",
#     filename="zImageTurbo_v1.safetensors",
#     local_dir=os.environ.get("MODEL_DIR", "/runpod-volume/models/checkpoints"),
#     local_dir_use_symlinks=False,
# )
# print(f"Z-Image Turbo saved to {out}")
print("Z-Image Turbo: update this script with the correct HuggingFace repo or CivitAI URL.")
print("Set ZIMAGE_MODEL env var on the RunPod endpoint to match the filename you download.")
PYEOF

# OPTION B — CivitAI (uncomment and set CIVITAI_MODEL_VERSION_ID):
# CIVITAI_TOKEN="${CIVITAI_TOKEN:?Set CIVITAI_TOKEN}"
# CIVITAI_MODEL_VERSION_ID="REPLACE_VERSION_ID"
# curl -L -o "$MODEL_DIR/zImageTurbo_v1.safetensors" \
#   "https://civitai.com/api/download/models/$CIVITAI_MODEL_VERSION_ID?token=$CIVITAI_TOKEN"

echo ""
echo "==> Done. Files in $MODEL_DIR:"
ls -lh "$MODEL_DIR"
