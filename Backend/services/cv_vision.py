"""
cv_vision.py
------------
Receives a list of JPEG/PNG frame bytes captured during the interview
and uses OpenCV's Haar cascade to detect whether a face is visible
in each frame. Returns the fraction of frames where a face was detected
as the eye_contact_ratio (0.0 – 1.0).

The frontend sends frames every 500 ms during recording.
If no frames are provided (e.g. webcam not used), returns None.
"""

import numpy as np

_face_cascade = None


def _get_cascade():
    global _face_cascade
    if _face_cascade is None:
        import cv2
        _face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    return _face_cascade


def face_detected(frame_bytes: bytes) -> bool:
    """Return True if at least one face is found in this image frame."""
    import cv2
    arr = np.frombuffer(frame_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return False
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = _get_cascade().detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4)
    return len(faces) > 0


def compute_eye_contact_ratio(frames: list[bytes]) -> float | None:
    """
    Given a list of raw frame bytes, return the fraction where a face
    was detected. Returns None when the list is empty.
    """
    if not frames:
        return None
    hits = sum(1 for f in frames if face_detected(f))
    return round(hits / len(frames), 3)
