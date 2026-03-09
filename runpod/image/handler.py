"""
KYNS Image Generation Worker — RunPod Serverless
Supports: Lustify v7 (SDXL) and Z-Image Turbo (SDXL)
Both models are loaded at startup for FlashBoot optimization.
Models should be pre-downloaded to the network volume via download_models.sh.
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

MODELS = {
    "lustify": os.environ.get("LUSTIFY_MODEL", "lustifySDXLNSFW_ggwpV7.safetensors"),
    "zimage": os.environ.get("ZIMAGE_MODEL", "zImageTurbo_v1.safetensors"),
}

pipes = {}


def load_sdxl_model(model_key: str):
    """Load a safetensors SDXL checkpoint from the network volume."""
    if model_key in pipes:
        return pipes[model_key]

    from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler

    filename = MODELS.get(model_key)
    if not filename:
        raise ValueError(f"Unknown model key: {model_key}")

    path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model not found at {path}. Run download_models.sh first.")

    print(f"[startup] Loading {model_key} from {path} ...")
    pipe = StableDiffusionXLPipeline.from_single_file(
        path,
        torch_dtype=torch.float16,
        use_safetensors=True,
        variant="fp16",
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config,
        use_karras_sigmas=True,
        algorithm_type="dpmpp_2m",
    )
    pipe.to("cuda")
    pipe.enable_attention_slicing()

    # Compile unet for faster inference on A40 (optional, first call slower)
    # pipe.unet = torch.compile(pipe.unet, mode="reduce-overhead", fullgraph=True)

    pipes[model_key] = pipe
    print(f"[startup] {model_key} loaded OK")
    return pipe


def image_to_base64(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=False)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def handler(job):
    inp = job.get("input", {})

    prompt = inp.get("prompt", "")
    if not prompt:
        return {"error": "prompt is required"}

    negative_prompt = inp.get(
        "negative_prompt", "lowres, blurry, bad anatomy, worst quality, low quality, watermark"
    )
    model_key = str(inp.get("model", "lustify")).lower()
    width = max(64, int(inp.get("width", 1024)) // 8 * 8)
    height = max(64, int(inp.get("height", 1024)) // 8 * 8)
    steps = min(50, max(1, int(inp.get("steps", 30))))
    cfg_scale = float(inp.get("cfg_scale", 7.0))
    seed_val = inp.get("seed")

    if model_key not in MODELS:
        return {"error": f"Unknown model '{model_key}'. Use 'lustify' or 'zimage'."}

    try:
        pipe = load_sdxl_model(model_key)
    except FileNotFoundError as e:
        return {"error": str(e)}

    seed = int(seed_val) if seed_val is not None else random.randint(0, 2**32 - 1)
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

    image = result.images[0]
    b64 = image_to_base64(image)

    return {"image": b64, "seed": seed, "model": model_key}


# Pre-load all available models at startup so FlashBoot can snapshot them
for key in list(MODELS.keys()):
    try:
        load_sdxl_model(key)
    except FileNotFoundError as e:
        print(f"[startup] Skipping {key}: {e}")
    except Exception as e:
        print(f"[startup] Error loading {key}: {e}")

runpod.serverless.start({"handler": handler})
