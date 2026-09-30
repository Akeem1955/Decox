"""User CRUD service — direct psycopg2 against Cloud SQL PostgreSQL."""
import logging
import json
from typing import Optional, Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings

logger = logging.getLogger(__name__)


def _get_conn():
    return psycopg2.connect(settings.DATABASE_URL)


def ensure_user_table():
    """Ensure the User table has the columns we need (idempotent)."""
    conn = _get_conn()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
            ALTER TABLE "User"
            ADD COLUMN IF NOT EXISTS "firebaseUid" TEXT UNIQUE,
            ADD COLUMN IF NOT EXISTS "interests" TEXT[] DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS "styles" TEXT[] DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
        """)
        logger.info("[UserService] User table columns ensured")
    except Exception as e:
        logger.warning(f"[UserService] Table migration note: {e}")
    finally:
        cur.close()
        conn.close()


def create_or_update_user(
    firebase_uid: str,
    email: str,
    name: str,
    interests: Optional[List[str]] = None,
    styles: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Upsert user profile. Creates if new, updates if exists.
    Returns the user row as dict.
    """
    conn = _get_conn()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check if user exists by firebaseUid OR email
        cur.execute(
            'SELECT * FROM "User" WHERE "firebaseUid" = %s OR email = %s',
            (firebase_uid, email)
        )
        existing = cur.fetchone()

        if existing:
            # Preserve existing preferences if caller did not supply new non-empty ones
            final_interests = (
                interests
                if (interests is not None and len(interests) > 0)
                else (existing.get("interests") or [])
            )
            final_styles = (
                styles
                if (styles is not None and len(styles) > 0)
                else (existing.get("styles") or [])
            )
            final_name = name if (name and name.strip()) else existing.get("name")
            final_email = email if (email and email.strip()) else existing.get("email")

            cur.execute(
                """
                UPDATE "User"
                SET "firebaseUid" = %s,
                    name = %s,
                    email = %s,
                    interests = %s,
                    styles = %s,
                    "updatedAt" = NOW()
                WHERE id = %s
                RETURNING *
                """,
                (firebase_uid, final_name, final_email, final_interests, final_styles, existing["id"]),
            )
        else:
            # Insert — generate a cuid-like ID
            import uuid
            user_id = str(uuid.uuid4())[:25]
            cur.execute(
                """
                INSERT INTO "User" (id, email, name, "firebaseUid", interests, styles, "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING *
                """,
                (user_id, email, name, firebase_uid, interests or [], styles or []),
            )

        user = dict(cur.fetchone())
        logger.info(f"[UserService] Upserted user: {user.get('id')} ({email})")
        return user
    except Exception as e:
        logger.error(f"[UserService] create_or_update_user failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()


def get_user_by_firebase_uid(firebase_uid: str) -> Optional[Dict[str, Any]]:
    """Fetch user profile by Firebase UID."""
    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            'SELECT * FROM "User" WHERE "firebaseUid" = %s',
            (firebase_uid,)
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def update_preferences(
    firebase_uid: str,
    interests: Optional[List[str]] = None,
    styles: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """Update user's interests and style preferences."""
    conn = _get_conn()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        updates = []
        params = []
        if interests is not None:
            updates.append('"interests" = %s')
            params.append(interests)
        if styles is not None:
            updates.append('"styles" = %s')
            params.append(styles)

        if not updates:
            return get_user_by_firebase_uid(firebase_uid)

        updates.append('"updatedAt" = NOW()')
        params.append(firebase_uid)

        cur.execute(
            f'UPDATE "User" SET {", ".join(updates)} WHERE "firebaseUid" = %s RETURNING *',
            params,
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        cur.close()
        conn.close()


def get_artisan_profile(artisan_id: str) -> Optional[Dict[str, Any]]:
    """Fetch artisan user profile + their portfolio items."""
    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            'SELECT id, name, email, "isArtisan" FROM "User" WHERE id = %s AND "isArtisan" = true',
            (artisan_id,)
        )
        user = cur.fetchone()
        if not user:
            return None

        cur.execute(
            """
            SELECT id, title, description, "imageUrl", category, "estimatedCostNaira"
            FROM "PortfolioItem"
            WHERE "userId" = %s
            ORDER BY "createdAt" DESC
            """,
            (artisan_id,)
        )
        items = [dict(row) for row in cur.fetchall()]

        result = dict(user)
        result["portfolio"] = items
        return result
    finally:
        cur.close()
        conn.close()


# Run migrations on import
try:
    ensure_user_table()
except Exception as e:
    logger.warning(f"[UserService] Initial migration skipped: {e}")
