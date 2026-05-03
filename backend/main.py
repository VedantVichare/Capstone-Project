"""
main.py  —  FastAPI backend for the Chest X-Ray Analyzer
---------------------------------------------------------
Exposes a single endpoint:
    POST /analyze   →  accepts an uploaded image, runs DenseNet inference
                        + Grad-CAM, calls the Gemini LLM, and returns the
                        Grad-CAM image (base64) plus the structured report.

Run with:
    uvicorn main:app --reload --port 8000
"""

import base64
import json
import os
import tempfile
import traceback
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
import uvicorn
from pydantic import BaseModel

# ── your existing modules ────────────────────────────────────────────────────
# Make sure inference.py and report_generation2.py are in the same folder as
# this file (or on PYTHONPATH).
import inference as inf
import report_generation as rg
from chatbot.report_chatbot import ask_report_chatbot
from chatbot.rag_chain import ask_knowledge_chatbot, _load_resources

class ReportChatRequest(BaseModel):
    question: str
    report:   dict
    history:  list[dict] = [] 


class KnowledgeChatRequest(BaseModel):
    question: str
    history:  list[dict] = []

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Chest X-Ray Analyzer API",
    description="DenseNet121 + Grad-CAM + Gemini LLM radiology report generator",
    version="1.0.0",
)

# Allow the frontend (running on any origin during dev) to call this API.
# Tighten origins to your actual domain before going to production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # e.g. ["http://localhost:3000"] for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Allowed file types ────────────────────────────────────────────────────────
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}
ALLOWED_EXTENSIONS    = {".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_MB      = 20


# ── Helper: PIL image → base64 string ────────────────────────────────────────
def pil_to_base64(pil_img: Image.Image, fmt: str = "PNG") -> str:
    buf = BytesIO()
    pil_img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ── Helper: file on disk → base64 string ─────────────────────────────────────
def file_to_base64(path: str | Path) -> str:
    with open(path, "rb") as fh:
        return base64.b64encode(fh.read()).decode("utf-8")


# ── Validation helper ─────────────────────────────────────────────────────────
def validate_upload(file: UploadFile) -> None:
    """Raise HTTPException if the upload is not an acceptable image."""
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'. "
                   f"Please upload a JPEG or PNG chest X-ray.",
        )
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type '{file.content_type}'. "
                   f"Please upload a JPEG or PNG image.",
        )


# ── Root health-check ─────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    """Simple health-check endpoint."""
    return {"status": "ok", "message": "Chest X-Ray Analyzer API is running."}


# ── Main analysis endpoint ────────────────────────────────────────────────────
@app.post("/analyze", tags=["Analysis"])
async def analyze(file: UploadFile = File(...)):
    """
    Accept a chest X-ray image, run inference + report generation, and return:

    {
        "gradcam_image":  "<base64-encoded PNG of the Grad-CAM visualisation>",
        "report":         { ...structured radiology report as JSON... },
        "num_findings":   <int>,
        "predictions":    [ ...raw model predictions... ]
    }
    """

    # ── 1. Validate the upload ──────────────────────────────────────────────
    validate_upload(file)

    raw_bytes = await file.read()

    if len(raw_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large. Maximum allowed size is {MAX_FILE_SIZE_MB} MB.",
        )

    # Quick sanity-check: can Pillow actually open this as an image?
    try:
        test_img = Image.open(BytesIO(raw_bytes))
        test_img.verify()           # raises if the file is corrupt
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file could not be read as an image. "
                   "Please upload a valid JPEG or PNG.",
        )

    # ── 2. Write to a temp file (inference.py works with file paths) ────────
    suffix = Path(file.filename).suffix if file.filename else ".png"

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix, delete=False, dir=tempfile.gettempdir()
        ) as tmp:
            tmp.write(raw_bytes)
            tmp_path = tmp.name          # e.g. /tmp/tmpabc123.png

        tmp_path_obj = Path(tmp_path)

        # ── 3. Run DenseNet inference + Grad-CAM ───────────────────────────
        print(f"[analyze] Running inference on: {tmp_path_obj.name}")
        inference_result = inf.run_inference(
            str(tmp_path_obj),
            save_visualization=True,    # saves *_gradcam.png next to the tmp file
        )

        # ── 4. Load the Grad-CAM visualisation image as base64 ────────────
        gradcam_b64: str | None = None
        viz_path = inference_result.get("visualization_path")

        if viz_path and Path(viz_path).exists():
            gradcam_b64 = file_to_base64(viz_path)
            print(f"[analyze] Grad-CAM image encoded ({Path(viz_path).name})")
        else:
            # No findings above threshold — return the original image instead
            print("[analyze] No Grad-CAM produced (no findings); returning original.")
            orig_pil = Image.open(BytesIO(raw_bytes)).convert("RGB")
            gradcam_b64 = pil_to_base64(orig_pil)

        # ── 5. Generate the LLM radiology report ──────────────────────────
        print("[analyze] Calling Gemini to generate report...")
        report = rg.run_pipeline(
            image_path=str(tmp_path_obj),
            json_input=inference_result,        # pass the dict directly
            output_path=str(
                tmp_path_obj.with_name(tmp_path_obj.stem + "_report.json")
            ),
        )

        # ── 6. Build and return the response ──────────────────────────────
        return JSONResponse(
            content={
                "gradcam_image": gradcam_b64,           # base64 PNG string
                "report":        report,                 # full JSON report
                "num_findings":  inference_result["num_findings"],
                "predictions":   inference_result["predictions"],
            }
        )

    except HTTPException:
        raise   # re-raise validation errors as-is

    except Exception as exc:
        # Log the full traceback server-side, return a clean error to the client
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(exc)}",
        )

    finally:
        # ── 7. Clean up all temp files ─────────────────────────────────────
        for candidate in [
            tmp_path_obj,
            tmp_path_obj.with_name(tmp_path_obj.stem + "_gradcam.png"),
            tmp_path_obj.with_name(tmp_path_obj.stem + "_report.json"),
        ]:
            try:
                if candidate.exists():
                    candidate.unlink()
            except Exception:
                pass    # best-effort cleanup
            

@app.on_event("startup")
async def startup_event():
    print("[startup] Loading RAG knowledge base...")
    _load_resources()
    print("[startup] RAG knowledge base ready")


@app.post("/report-chat", tags=["Chatbot"])
async def report_chat(req: ReportChatRequest):
    """
    Accept a question + the report JSON + optional conversation history.
    Returns the assistant's reply grounded strictly in the report.
 
    Request body:
    {
        "question": "What does the Effusion finding mean?",
        "report":   { ...full report JSON from /analyze... },
        "history":  []   // pass previous turns for multi-turn conversations
    }
    """
    try:
        answer = ask_report_chatbot(
            report=req.report,
            question=req.question,
            history=req.history,
        )
        return {"answer": answer}
 
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
 
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Chatbot error: {str(exc)}"
        )


@app.post("/knowledge-chat", tags=["Chatbot"])
async def knowledge_chat(req: KnowledgeChatRequest):
    try:
        answer = ask_knowledge_chatbot(
            question=req.question,
            history=req.history,
        )
        return {"answer": answer}

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Knowledge chatbot error: {str(exc)}"
        )

# ── Entry point (optional — you can also use `uvicorn main:app`) ──────────────
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)