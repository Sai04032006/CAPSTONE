import requests


# ============================================================
# FASTAPI SERVER
# ============================================================

API_URL = "http://127.0.0.1:8000"


# ============================================================
# TEST DATA
# ============================================================

session_id = 1

student_id = "2300033017"

presence_seconds = 90


# ============================================================
# ATTENDANCE DATA
# ============================================================

attendance_data = {

    "session_id": session_id,

    "student_id": student_id,

    "presence_seconds": presence_seconds
}


# ============================================================
# SEND TO FASTAPI
# ============================================================

response = requests.post(

    f"{API_URL}/attendance/",

    json=attendance_data
)


# ============================================================
# PRINT RESULT
# ============================================================

print()
print("=" * 60)
print("FASTAPI ATTENDANCE TEST")
print("=" * 60)

print()

print("HTTP Status:", response.status_code)

print()

print("Response:")

print(
    response.json()
)

print()
print("=" * 60)