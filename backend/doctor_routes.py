from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from database import reports_collection, db
import bcrypt

router = APIRouter()

# ── Collections ───────────────────────────────────────────────────────────────
doctors_collection  = db["doctors"]
feedbacks_collection = db["feedbacks"]


# ── Pydantic models ───────────────────────────────────────────────────────────
class DoctorLoginRequest(BaseModel):
    email:    str
    password: str

class SendToDoctorRequest(BaseModel):
    report_id:     str          # MongoDB _id of the report
    patient_email: str

class FeedbackRequest(BaseModel):
    report_id:    str
    doctor_email: str
    feedback:     str


# ── Seed default doctor (call once on startup) ────────────────────────────────
def seed_doctor():
    """Insert a default doctor account if none exists."""
    existing = doctors_collection.find_one({"email": "doctor@pneumavision.com"})
    if not existing:
        hashed = bcrypt.hashpw(b"doctor123", bcrypt.gensalt())
        doctors_collection.insert_one({
            "name":       "Dr. Sarah Mitchell",
            "email":      "doctor@pneumavision.com",
            "password":   hashed,
            "created_at": datetime.utcnow(),
        })
        print("[startup] Default doctor account created → doctor@pneumavision.com / doctor123")


# ── Helper: strip non-serialisable fields ─────────────────────────────────────
def clean_doc(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    # drop heavy base64 blobs from list views — frontend fetches full detail separately
    doc.pop("xray_image",    None)
    doc.pop("gradcam_image", None)
    return doc


# ── POST /doctor/login ────────────────────────────────────────────────────────
@router.post("/doctor/login", tags=["Doctor"])
def doctor_login(req: DoctorLoginRequest):
    doctor = doctors_collection.find_one({"email": req.email})
    if not doctor:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not bcrypt.checkpw(req.password.encode(), doctor["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    return {
        "message": "Login successful",
        "doctor": {
            "name":  doctor["name"],
            "email": doctor["email"],
        }
    }


# ── POST /doctor/send-report ──────────────────────────────────────────────────
@router.post("/doctor/send-report", tags=["Doctor"])
def send_report_to_doctor(req: SendToDoctorRequest):
    """Mark a report as sent to the doctor."""
    try:
        oid = ObjectId(req.report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report ID.")

    result = reports_collection.update_one(
        {"_id": oid, "email": req.patient_email},
        {"$set": {
            "sent_to_doctor": True,
            "sent_at":        datetime.utcnow(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"message": "Report sent to doctor successfully."}


# ── GET /doctor/reports ───────────────────────────────────────────────────────
@router.get("/doctor/reports", tags=["Doctor"])
def get_doctor_reports():
    """Return all reports that patients have sent to the doctor."""
    docs = list(reports_collection.find({"sent_to_doctor": True}))
    result = []
    for doc in docs:
        rid = str(doc["_id"])
        # attach feedback if exists
        fb = feedbacks_collection.find_one({"report_id": rid})
        entry = {
            "id":           rid,
            "name":         doc.get("name", "N/A"),
            "email":        doc.get("email", ""),
            "age":          doc.get("age", "N/A"),
            "sex":          doc.get("sex", "N/A"),
            "filename":     doc.get("filename", ""),
            "created_at":   doc.get("created_at", "").isoformat() if doc.get("created_at") else "",
            "sent_at":      doc.get("sent_at", "").isoformat()    if doc.get("sent_at")    else "",
            "has_feedback": fb is not None,
            "feedback":     fb["feedback"] if fb else None,
            "feedback_at":  fb["created_at"].isoformat() if fb and fb.get("created_at") else None,
            # include images only for full view
            "gradcam_image": doc.get("gradcam_image", ""),
            "xray_image":    doc.get("xray_image", ""),
            "report":        doc.get("report", {}),
        }
        result.append(entry)
    # newest first
    result.sort(key=lambda x: x["sent_at"], reverse=True)
    return result


# ── POST /doctor/feedback ─────────────────────────────────────────────────────
@router.post("/doctor/feedback", tags=["Doctor"])
def submit_feedback(req: FeedbackRequest):
    """Doctor submits or updates feedback for a report."""
    # upsert so re-submitting overwrites
    feedbacks_collection.update_one(
        {"report_id": req.report_id},
        {"$set": {
            "report_id":    req.report_id,
            "doctor_email": req.doctor_email,
            "feedback":     req.feedback.strip(),
            "created_at":   datetime.utcnow(),
        }},
        upsert=True
    )
    # flag on the report itself so patient can see a badge
    try:
        reports_collection.update_one(
            {"_id": ObjectId(req.report_id)},
            {"$set": {"has_feedback": True}}
        )
    except Exception:
        pass
    return {"message": "Feedback submitted successfully."}


# ── GET /patient/reports?email=... ────────────────────────────────────────────
@router.get("/patient/reports", tags=["Patient"])
def get_patient_reports(email: str):
    """Return all reports for a patient, with feedback attached if available."""
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    docs = list(reports_collection.find({"email": email}))
    result = []
    for doc in docs:
        rid = str(doc["_id"])
        fb  = feedbacks_collection.find_one({"report_id": rid})
        entry = {
            "id":            rid,
            "filename":      doc.get("filename", ""),
            "created_at":    doc.get("created_at", "").isoformat() if doc.get("created_at") else "",
            "sent_to_doctor": doc.get("sent_to_doctor", False),
            "has_feedback":  fb is not None,
            "feedback":      fb["feedback"]              if fb else None,
            "feedback_at":   fb["created_at"].isoformat() if fb and fb.get("created_at") else None,
            "report":        doc.get("report", {}),
            "gradcam_image": doc.get("gradcam_image", ""),
            "xray_image":    doc.get("xray_image", ""),
        }
        result.append(entry)
    result.sort(key=lambda x: x["created_at"], reverse=True)
    return result