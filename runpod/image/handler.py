"""
KYNS Image Generation Worker — RunPod Serverless
GPU: A40 (48GB VRAM)
Models:
  - Lustify v7 (SDXL 1.0 FP16 safetensors) — from CivitAI via network volume
  - Z-Image Turbo (DiT 6B BF16) — from HuggingFace via network volume cache
"""

import os
import io
import random
import base64
import runpod
import torch
from PIL import Image

VOLUME_PATH = os.environ.get("VOLUME_PATH", "/runpod-volume")
MODEL_DIR = os.path.join(VOLUME_PATH, "models", "checkpoints")
HF_CACHE = os.path.join(VOLUME_PATH, "hf-cache")

LUSTIFY_FILENAME = os.environ.get("LUSTIFY_MODEL", "lustifySDXLNSFW_ggwpV7.safetensors")
LUSTIFY_PATH = os.path.join(MODEL_DIR, LUSTIFY_FILENAME)
ZIMAGE_REPO = "Tongyi-MAI/Z-Image-Turbo"

os.environ.setdefault("HF_HOME", HF_CACHE)
os.environ.setdefault("TRANSFORMERS_CACHE", HF_CACHE)

pipes = {}


def _download_lustify():
    import requests

    os.makedirs(MODEL_DIR, exist_ok=True)
    token = os.environ.get("CIVITAI_TOKEN", "")
    url = "https://civitai.com/api/download/models/2155386"
    if token:
        url += f"?token={token}"

    print(f"[startup] Downloading Lustify v7 GGWP to {LUSTIFY_PATH}...")
    with requests.get(url, stream=True, timeout=300, allow_redirects=True) as r:
        r.raise_for_status()
        with open(LUSTIFY_PATH, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                f.write(chunk)
    print(f"[startup] Lustify v7 download complete ({os.path.getsize(LUSTIFY_PATH) // 1_000_000} MB)")


def load_lustify():
    if "lustify" in pipes:
        return pipes["lustify"]

    from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler

    if not os.path.exists(LUSTIFY_PATH):
        _download_lustify()

    print(f"[startup] Loading Lustify v7 from {LUSTIFY_PATH}...")
    pipe = StableDiffusionXLPipeline.from_single_file(
        LUSTIFY_PATH,
        torch_dtype=torch.float16,
        use_safetensors=True,
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config,
        use_karras_sigmas=True,
        algorithm_type="dpmpp_2m",
    )
    pipe.to("cuda")
    pipe.enable_attention_slicing()
    pipes["lustify"] = pipe
    print("[startup] Lustify v7 loaded OK")
    return pipe


def load_zimage():
    if "zimage" in pipes:
        return pipes["zimage"]

    from diffusers import ZImagePipeline

    os.makedirs(HF_CACHE, exist_ok=True)
    print(f"[startup] Loading Z-Image Turbo from HuggingFace (cache: {HF_CACHE})...")
    pipe = ZImagePipeline.from_pretrained(
        ZIMAGE_REPO,
        torch_dtype=torch.bfloat16,
        cache_dir=HF_CACHE,
        low_cpu_mem_usage=False,
    )
    pipe.to("cuda")
    pipes["zimage"] = pipe
    print("[startup] Z-Image Turbo loaded OK")
    return pipe


def image_to_base64(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=False)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def generate_lustify(pipe, prompt, negative_prompt, width, height, steps, cfg_scale, seed):
    generator = torch.Generator(device="cuda").manual_seed(seed)
    with torch.inference_mode():
        result = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=cfg_scale,
            generator=generator,
            num_images_per_prompt=1,
        )
    return result.images[0]


def generate_zimage(pipe, prompt, width, height, seed):
    generator = torch.Generator(device="cuda").manual_seed(seed)
    with torch.inference_mode():
        result = pipe(
            prompt=prompt,
            height=height,
            width=width,
            num_inference_steps=9,
            guidance_scale=0.0,
            generator=generator,
            num_images_per_prompt=1,
        )
    return result.images[0]


def handler(job):
    inp = job.get("input", {})

    prompt = inp.get("prompt", "")
    if not prompt:
        return {"error": "prompt is required"}

    negative_prompt = inp.get(
        "negative_prompt",
        "lowres, blurry, bad anatomy, worst quality, low quality, watermark",
    )
    model_key = str(inp.get("model", "lustify")).lower()
    width = max(64, int(inp.get("width", 1024)) // 8 * 8)
    height = max(64, int(inp.get("height", 1024)) // 8 * 8)
    steps = min(50, max(1, int(inp.get("steps", 30))))
    cfg_scale = float(inp.get("cfg_scale", 7.0))
    seed_val = inp.get("seed")
    seed = int(seed_val) if seed_val is not None else random.randint(0, 2**32 - 1)

    try:
        if model_key == "zimage":
            pipe = load_zimage()
            image = generate_zimage(pipe, prompt, width, height, seed)
        elif model_key == "lustify":
            pipe = load_lustify()
            image = generate_lustify(pipe, prompt, negative_prompt, width, height, steps, cfg_scale, seed)
        else:
            return {"error": f"Unknown model '{model_key}'. Use 'lustify' or 'zimage'."}
    except Exception as e:
        return {"error": f"Generation failed: {str(e)}"}

    return {"image": image_to_base64(image), "seed": seed, "model": model_key}


# Pre-load all models at startup so FlashBoot can snapshot them
for _key, _loader in [("lustify", load_lustify), ("zimage", load_zimage)]:
    try:
        _loader()
    except Exception as _e:
        print(f"[startup] Warning: could not load {_key}: {_e}")

runpod.serverless.start({"handler": handler})
