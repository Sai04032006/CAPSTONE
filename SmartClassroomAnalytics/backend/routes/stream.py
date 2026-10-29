import time
from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse

router = APIRouter(
    prefix="/stream",
    tags=["Stream"]
)

# In-memory storage for latest annotated AI frame
_latest_frame: bytes | None = None
_last_update: float = 0.0


@router.post("/frame")
async def receive_frame(request: Request):
    """
    Receives an annotated JPEG frame from the Python AI tracking application.
    """
    global _latest_frame, _last_update
    _latest_frame = await request.body()
    _last_update = time.time()
    return {"status": "ok"}


@router.get("/status")
def get_stream_status():
    """
    Returns whether the AI camera stream is actively transmitting frames.
    """
    age = time.time() - _last_update if _last_update > 0 else None
    is_active = _latest_frame is not None and age is not None and age < 4.0
    return {
        "active": is_active,
        "age_seconds": round(age, 2) if age is not None else None
    }


@router.get("/video")
def get_video_stream():
    """
    MJPEG streaming endpoint for browser HTML img tags.
    """
    def frame_generator():
        while True:
            if _latest_frame is not None and (time.time() - _last_update) < 5.0:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + _latest_frame
                    + b"\r\n"
                )
            time.sleep(0.04)  # ~25 fps

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get("/snapshot")
def get_snapshot():
    """
    Returns single latest frame as JPEG image.
    """
    if _latest_frame is not None and (time.time() - _last_update) < 5.0:
        return Response(content=_latest_frame, media_type="image/jpeg")
    return Response(status_code=404)
