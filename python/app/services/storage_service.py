"""GCS signed URL generation for image uploads and reads."""
import logging
import datetime
from typing import Optional
from google.cloud import storage

from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[storage.Client] = None


def _get_client() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client()
    return _client


def _get_bucket():
    return _get_client().bucket(settings.GCS_BUCKET)


def generate_upload_url(
    uid: str,
    filename: str,
    content_type: str = "image/jpeg",
    folder: str = "rooms",
    expiry_minutes: int = 15,
) -> dict:
    """
    Generate a signed upload URL for direct mobile → GCS upload.
    
    Returns:
        {
            "upload_url": str (signed PUT URL),
            "blob_path": str (e.g. "users/abc123/rooms/photo.jpg"),
            "public_url": str (unsigned read URL — requires bucket to be public or use signed read)
        }
    """
    blob_path = f"users/{uid}/{folder}/{filename}"
    bucket = _get_bucket()
    blob = bucket.blob(blob_path)

    upload_url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(minutes=expiry_minutes),
        method="PUT",
        content_type=content_type,
    )

    logger.info(f"[Storage] Generated upload URL for: {blob_path}")
    return {
        "upload_url": upload_url,
        "blob_path": blob_path,
        "content_type": content_type,
    }


def generate_read_url(
    blob_path: str,
    expiry_minutes: int = 60,
) -> str:
    """Generate a signed read URL for an existing GCS object."""
    bucket = _get_bucket()
    blob = bucket.blob(blob_path)

    read_url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(minutes=expiry_minutes),
        method="GET",
    )
    return read_url


def get_public_url(blob_path: str) -> str:
    """Get the public URL (only works if bucket has public access)."""
    return f"https://storage.googleapis.com/{settings.GCS_BUCKET}/{blob_path}"


def upload_bytes(
    data: bytes,
    filename: str,
    content_type: str = "image/jpeg",
    folder: str = "artisan_portfolio",
) -> str:
    """Uploads raw image bytes to GCS and returns public URL."""
    blob_path = f"{folder}/{filename}"
    bucket = _get_bucket()
    blob = bucket.blob(blob_path)
    blob.upload_from_string(data, content_type=content_type)
    return f"https://storage.googleapis.com/{settings.GCS_BUCKET}/{blob_path}"
