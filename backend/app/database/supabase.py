import logging
from typing import Optional
from supabase import Client, create_client
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Returns a singleton instance of the Supabase Client.
    Initializes lazily using SUPABASE_URL and SUPABASE_KEY.
    """
    global _supabase_client
    if _supabase_client is None:
        try:
            _supabase_client = create_client(
                supabase_url=settings.SUPABASE_URL,
                supabase_key=settings.SUPABASE_KEY,
            )
            logger.info("Supabase client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            raise
    return _supabase_client


def set_supabase_client(client: Client) -> None:
    """Helper to inject a custom or mock Supabase client for testing."""
    global _supabase_client
    _supabase_client = client


def reset_supabase_client() -> None:
    """Resets the singleton Supabase client."""
    global _supabase_client
    _supabase_client = None
