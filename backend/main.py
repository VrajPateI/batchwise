import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel # <--- NEW: Data Validation
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
url: str = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
# Use Service Key if available to bypass RLS, otherwise fallback to Anon Key
key: str = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("VITE_SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

supabase: Client = create_client(url, key)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. DEFINE THE DATA SHAPE (The Form) ---
class StudentSchema(BaseModel):
    name: str
    parent_phone: str
    batch_name: str
    tuition_id: str # We need to know which tuition they belong to

@app.get("/")
def read_root():
    return {"status": "Active"}

# --- 2. GET STUDENTS (Read) ---
@app.get("/students")
def get_students():
    # Fetch all students ordered by creation time
    response = supabase.table("students").select("*").order("created_at").execute()
    return response.data

# --- 3. ADD STUDENT (Write) ---
@app.post("/students")
def create_student(student: StudentSchema):
    # Convert the Pydantic model to a dictionary
    student_data = student.dict()
    
    # Send to Supabase
    try:
        response = supabase.table("students").insert(student_data).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- 4. PROMOTION LOGIC (Bulk Update) ---

class PromotionRequest(BaseModel):
    student_ids: list[str]
    new_fee: int
    new_batch: str
    institute_id: str

def calculate_new_balance(current_total: int, current_paid: int, new_fee: int) -> int:
    """
    Calculates the starting 'paid_amount' for the new year based on previous year's payments.
    
    Scenario A: Paid Exact (10k/10k) -> Carry 0 -> New Status: 0 paid / new_fee
    Scenario B: Paid Extra (12k/10k) -> Carry 2k -> New Status: 2k paid / new_fee
    Scenario C: Pending Dues (8k/10k) -> Debt Forgiven -> New Status: 0 paid / new_fee
    """
    if current_paid >= current_total:
        # User paid full or extra. The extra amount is carried forward.
        return current_paid - current_total
    else:
        # User has pending dues. We do NOT carry forward debt. Clean slate.
        return 0

@app.post("/promote")
def promote_students(request: PromotionRequest):
    try:
        # 1. Fetch all target students to verify and calculate
        # We fetch explicitly to check institute_id securely and get current fee status
        response = supabase.table("students").select("*").in_("id", request.student_ids).execute()
        students = response.data

        if not students:
            return {"message": "No students found", "updated_count": 0}

        updates = []
        valid_ids = []

        for student in students:
            # SECURITY CHECK: Ensure student belongs to the requester's institute
            if student.get("institute_id") != request.institute_id:
                print(f"Skipping student {student.get('id')}: Institute mismatch")
                continue
            
            # 2. MATCH LOGIC
            old_total = student.get("total_fee_package", 0) or 0
            old_paid = student.get("paid_amount", 0) or 0
            
            # Calculate the credit (if any) to start the new year with
            opening_balance = calculate_new_balance(old_total, old_paid, request.new_fee)
            
            # 3. CLEAN SLATE PROTOCOL
            # - Reset pending_payment to 0
            # - Clear last_payment_status (so no 'rejected' icons linger)
            # - Update batch and total fee
            update_payload = {
                "id": student["id"], 
                "batch_name": request.new_batch,
                "total_fee_package": request.new_fee,
                "paid_amount": opening_balance,
                "pending_payment": 0,
                "last_payment_status": None, 
            }
            updates.append(update_payload)
            valid_ids.append(student["id"])

        if not updates:
             raise HTTPException(status_code=403, detail="No valid students found for this institute")

        # 4. BULK UPDATE EXECUTION
        data = supabase.table("students").upsert(updates).execute()
        
        # 5. CLEAR PENDING REQUESTS
        # Delete any pending verification requests for these students so the new year is clean
        if valid_ids:
            supabase.table("payment_requests").delete().in_("student_id", valid_ids).execute()

        return {"status": "success", "updated": len(updates), "details": updates}

    except Exception as e:
        print(f"Error promoting students: {e}")
        raise HTTPException(status_code=500, detail=str(e))