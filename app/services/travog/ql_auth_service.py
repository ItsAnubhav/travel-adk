"""
QL Auth Service for Travog API authentication.
"""
import asyncio
import logging
from typing import Any, Dict, Optional
from datetime import datetime, timedelta, timezone
import httpx

from app.services.travog.travog_constants import TravogConstants
from app.services.travog.models.requests import QLAuthRequest
from app.services.travog.models.responses import AuthResponse, RootDataTokenResponse, DataTokenResponse

logger = logging.getLogger(__name__)


class QLAuthService:
    """Authentication service for Travog/QuadLabs API."""
    
    def __init__(self, http_client: Optional[httpx.AsyncClient] = None):
        """
        Initialize QL Auth Service.
        
        Args:
            http_client: Optional HTTP client (will create if not provided)
        """
        self._http_client = http_client
        self._lock = asyncio.Lock()
        self._cached_token: Optional[str] = None
        self._expires_at: datetime = datetime.min
        self._owns_client = http_client is None
    
    def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client
    
    async def get_token(
        self,
        auth_request: QLAuthRequest
    ) -> Optional[str]:
        """
        Get access token with caching.
        
        Args:
            auth_request: Authentication request
            
        Returns:
            Access token or None on failure
        """
        # Return cached token if still valid
        if self._cached_token and datetime.now(timezone.utc) < self._expires_at:
            logger.debug(f"AuthService: returning cached token, expires at {self._expires_at}")
            return self._cached_token
        
        async with self._lock:
            # Double-check after acquiring lock
            if self._cached_token and datetime.now(timezone.utc) < self._expires_at:
                return self._cached_token
            
            logger.info(f"AuthService: requesting token from {TravogConstants.QL_AUTH_ENDPOINT}")
            
            try:
                client = self._get_client()
                
                # Prepare request
                response = await client.post(
                    f"{TravogConstants.BASE_URL}{TravogConstants.QL_AUTH_ENDPOINT}",
                    json=auth_request.model_dump(by_alias=True),
                    headers={
                        "Content-Type": "application/json",
                        "X-Skip-Auth": "1"  # Skip auth for token acquisition
                    }
                )
                
                if not response.is_success:
                    logger.warning(f"AuthService: token request failed with {response.status_code}")
                    return None
                
                payload = AuthResponse(**response.json())
                
                if not payload.access_token:
                    logger.warning("AuthService: token response payload was null")
                    return None
                
                self._cached_token = payload.access_token
                
                # Set expiration with 60-second buffer
                expires_in = payload.expires_in if payload.expires_in > 60 else payload.expires_in
                buffer = 60 if expires_in > 60 else 0
                self._expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in - buffer)
                
                logger.info(f"AuthService: acquired token, expires at {self._expires_at}")
                return self._cached_token
                
            except httpx.HTTPError as e:
                logger.error(f"AuthService: HTTP error during token acquisition: {e}")
                return None
            except Exception as e:
                logger.error(f"AuthService: error during token acquisition: {e}")
                return None
    
    async def get_data_token(
        self,
        company_id: str,
        user_name: str,
        password: str
    ) -> Optional[DataTokenResponse]:
        """
        Get data token (identity and scope tokens).
        
        Args:
            company_id: Company ID
            user_name: Username
            password: Password
            
        Returns:
            DataTokenResponse with identity and scope tokens, or None on failure
        """
        logger.info(f"GetDataToken: requesting for companyId={company_id}")
        
        try:
            client = self._get_client()
            
            payload = {
                "companyId": company_id,
                "userName": user_name,
                "password": password
            }
            
            response = await client.post(
                TravogConstants.AUTH_URL,
                json=payload,
                headers={
                    "accept": "*/*",
                    "Content-Type": "application/json"
                }
            )
            
            if not response.is_success:
                logger.warning(
                    f"GetDataToken: upstream returned {response.status_code} for companyId={company_id}"
                )
                return None
            
            root_response = RootDataTokenResponse(**response.json())
            
            if not root_response.data:
                logger.warning(f"GetDataToken: response payload was null for companyId={company_id}")
                return None
            
            logger.info(f"GetDataToken: acquired token for companyId={company_id}")
            return root_response.data
            
        except httpx.HTTPError as e:
            logger.error(f"GetDataToken: HTTP error for companyId={company_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"GetDataToken: error for companyId={company_id}: {e}")
            return None
    
    async def forge_login(
        self,
        company_id: str,
        user_name: str,
        password: str,
        source: str = "SBT",
        account_no: str = "",
    ) -> Optional[Dict[str, Any]]:
        """Login via the forge v1 JWT endpoint.

        POSTs to ``/forge/api/v1/auth/jwt/login`` with the JSON body the
        upstream expects and returns the parsed JSON response (or None on
        failure). Credentials are not logged.
        """
        logger.info(
            "ForgeLogin: requesting for companyId=%s userName=%s source=%s",
            company_id, user_name, source,
        )

        payload = {
            "companyId": company_id,
            "userName": user_name,
            "password": password,
            "source": source,
            "accountNo": account_no,
        }

        try:
            client = self._get_client()
            response = await client.post(
                TravogConstants.FORGE_LOGIN_URL,
                json=payload,
                headers={
                    "accept": "application/json",
                    "Content-Type": "application/json",
                },
            )

            if not response.is_success:
                logger.warning(
                    "ForgeLogin: upstream returned %s for companyId=%s body=%s",
                    response.status_code, company_id, response.text,
                )
                return None

            return response.json()

        except httpx.HTTPError as e:
            logger.error("ForgeLogin: HTTP error for companyId=%s: %s", company_id, e)
            return None
        except Exception as e:
            logger.error("ForgeLogin: error for companyId=%s: %s", company_id, e)
            return None

    async def refresh_forge_token(
        self, access_token: str, refresh_token: str
    ) -> Optional[Dict[str, Any]]:
        """
        Refresh Forge JWT token.
        
        Args:
            access_token: Current (expired) access token
            refresh_token: Refresh token
            
        Returns:
            Dict containing new tokens or None on failure
        """
        logger.info("AuthService: refreshing Forge token")
        
        payload = {
            "refreshToken": refresh_token
        }
        
        try:
            client = self._get_client()
            response = await client.post(
                TravogConstants.FORGE_REFRESH_URL,
                json=payload,
                headers={
                    "accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {access_token}"
                },
            )
            
            if not response.is_success:
                logger.warning(
                    "ForgeRefresh: upstream returned %s body=%s",
                    response.status_code, response.text,
                )
                return None
                
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error("ForgeRefresh: HTTP error: %s", e)
            return None
        except Exception as e:
            logger.error("ForgeRefresh: error: %s", e)
            return None

    async def close(self):
        """Close HTTP client if owned by this service."""
        if self._owns_client and self._http_client:
            await self._http_client.aclose()
            self._http_client = None
