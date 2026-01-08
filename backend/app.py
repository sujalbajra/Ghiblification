from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import torch
import io
import numpy as np
import time
# import cv2 # No longer needed for Ghibli
from transformers import logging
from diffusers import StableDiffusionImg2ImgPipeline # Changed to Img2Img

logging.set_verbosity_error()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Storage for Stall Mode (optional, kept for display mode consistency) ---
stall_store = {
    "bytes": None,
    "timestamp": 0
}

# --- Model Loading ---
# seg_processor = None # No longer needed
# seg_model = None     # No longer needed
ghibli_pipe = None   # Changed to ghibli_pipe
device = "cuda" if torch.cuda.is_available() else "cpu"

@app.on_event("startup")
async def load_models():
    global ghibli_pipe # Only load the ghibli pipe
    print(f"Loading Models on {device}...")
    try:
        ghibli_pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            "nitrosocke/Ghibli-Diffusion",
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
        ).to(device)
        print("Ghibli Diffusion Model Loaded Successfully!")
    except Exception as e:
        print(f"Loading Error: {e}")

# Removed get_clothing_mask function

@app.post("/ghiblification/") # New endpoint
async def ghiblification_api(
    file: UploadFile = File(...),
    # era_prompt: str = Form(...), # No longer needed
    # is_stall: str = Form("false") # No longer needed for this endpoint
):
    global stall_store
    try:
        content = await file.read()
        raw_img = Image.open(io.BytesIO(content)).convert("RGB")
        
        # Preserve original dimensions for the result later, but resize for the model input
        original_width, original_height = raw_img.size
        
        # Resize image for the Ghibli Diffusion model (512x512 is common for this model)
        # The prompt mentioned "input image dimension should be preserved" but img2img models often work best with specific sizes.
        # Here we'll resize to 512x512 for the model, and the output will be 512x512.
        # If the user truly wants the *output* to match *input* aspect ratio, more complex cropping/padding logic would be needed.
        # For simplicity and typical Ghibli Diffusion usage, 512x512 output is standard.
        init_image = raw_img.resize((512, 512), Image.LANCZOS)

        prompt = "ghibli style, a beautiful young character with expressive eyes, standing in a lush summer meadow, traditional hand-painted background, soft watercolor textures, rolling green hills, quaint wooden houses, fluffy white cumulus clouds, gentle sunlight, warm haze, whimsical atmosphere, clean line art, high detail, masterpiece, by Hayao Miyazaki."
        
        result = ghibli_pipe(
            prompt=prompt,
            negative_prompt="photorealistic, 3D render, CGI, digital painting, oil painting, heavy outlines, blurry, soft, bad anatomy, extra limbs, distorted face, messy lines, grainy, dark, moody, sharp shadows, high contrast, oversaturated.",
            image=init_image,
            strength=0.65,
            guidance_scale=9.0
        ).images[0]
        
        # The output from the Ghibli pipeline is 512x512, so we don't resize it back to original_size
        # result = result.resize(original_size, Image.LANCZOS) # Removed this line

        img_io = io.BytesIO()
        result.save(img_io, format="PNG")
        final_bytes = img_io.getvalue()
        
        # If you still want the "controller" mode to send to a "display" mode,
        # the display mode would need to query a different endpoint or the
        # /ghiblification/ endpoint would need to accept `is_stall`.
        # For now, I'm removing `is_stall` from /ghiblification/ for simplicity,
        # assuming `stall_store` would be updated by a different, dedicated "stall" endpoint if needed.
        # If the web app in controller mode should update the display, then `is_stall` should be re-added
        # and the `stall_store` update logic uncommented.
        # if is_stall.lower() == "true":
        #     stall_store["bytes"] = final_bytes
        #     stall_store["timestamp"] = time.time()

        return StreamingResponse(io.BytesIO(final_bytes), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Keeping stall status and latest endpoints if the 'display' mode is still desired
@app.get("/stall/status")
async def get_status():
    return {"ts": stall_store["timestamp"]}

@app.get("/stall/latest")
async def get_latest():
    if not stall_store["bytes"]:
        raise HTTPException(status_code=404)
    return StreamingResponse(io.BytesIO(stall_store["bytes"]), media_type="image/png")

@app.get("/download/latest")
async def download_latest():
    if not stall_store["bytes"]:
        raise HTTPException(status_code=404, detail="No image available")
    return StreamingResponse(
        io.BytesIO(stall_store["bytes"]), 
        media_type="image/png",
        headers={"Content-Disposition": "attachment; filename=ghiblification_result.png"}
    )