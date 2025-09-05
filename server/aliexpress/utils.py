"""
AliExpress API Utilities
Helper functions for API calls and token management
"""

import os
import httpx
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# AliExpress API Configuration
ALIEXPRESS_API_BASE_URL = "https://api-sg.aliexpress.com"
ALIEXPRESS_TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"

APP_KEY = os.getenv("ALIEXPRESS_APP_KEY", "518666")
APP_SECRET = os.getenv("ALIEXPRESS_APP_SECRET", "3U2xSKRDIgMH1Vawc2sH8hnZP5QNqywY")

def get_aliexpress_headers(token: str, method: str = None) -> Dict[str, str]:
    """
    Generate headers for AliExpress API requests
    
    Args:
        token: Access token
        method: API method name (optional)
        
    Returns:
        Dictionary of headers
    """
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    # Add method-specific headers if provided
    if method:
        headers["X-AliExpress-Method"] = method
    
    return headers

def get_aliexpress_auth_headers(token: str) -> Dict[str, str]:
    """
    Generate authentication headers for AliExpress API
    
    Args:
        token: Access token
        
    Returns:
        Dictionary of authentication headers
    """
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "SmartLinks-Autopilot/1.0"
    }

async def refresh_token(old_refresh_token: str) -> Dict[str, Any]:
    """
    Refresh AliExpress access token using refresh token
    
    Args:
        old_refresh_token: Existing refresh token
        
    Returns:
        New token data dictionary
        
    Raises:
        Exception: If token refresh fails
    """
    if not old_refresh_token:
        raise ValueError("Refresh token is required")
    
    refresh_data = {
        "grant_type": "refresh_token",
        "client_id": APP_KEY,
        "client_secret": APP_SECRET,
        "refresh_token": old_refresh_token
    }
    
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info("Refreshing AliExpress access token...")
            
            response = await client.post(
                ALIEXPRESS_TOKEN_URL,
                data=refresh_data,
                headers=headers
            )
            
            logger.info(f"Token refresh response status: {response.status_code}")
            
            if response.status_code == 200:
                response_data = response.json()
                
                if "access_token" in response_data:
                    # Add timestamp and expiration info
                    response_data["obtained_at"] = datetime.utcnow().isoformat()
                    
                    if "expires_in" in response_data:
                        expires_at = datetime.utcnow() + timedelta(seconds=int(response_data["expires_in"]))
                        response_data["expires_at"] = expires_at.isoformat()
                    
                    # Save refreshed token
                    await save_token_to_file(response_data)
                    
                    logger.info("Token refreshed successfully")
                    return response_data
                else:
                    error_msg = response_data.get("error_description", "Token refresh failed")
                    logger.error(f"Token refresh error: {error_msg}")
                    raise Exception(f"Token refresh failed: {error_msg}")
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
                logger.error(f"Token refresh HTTP error: {response.status_code} - {error_data}")
                raise Exception(f"Token refresh failed with status {response.status_code}")
                
    except httpx.TimeoutException:
        logger.error("Token refresh request timed out")
        raise Exception("Token refresh request timed out")
        
    except httpx.RequestError as e:
        logger.error(f"Token refresh request error: {str(e)}")
        raise Exception(f"Token refresh request failed: {str(e)}")
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse token refresh response: {str(e)}")
        raise Exception("Invalid response from AliExpress API")
        
    except Exception as e:
        logger.error(f"Unexpected error during token refresh: {str(e)}")
        raise

async def save_token_to_file(token_data: Dict[str, Any]) -> None:
    """
    Save token data to file
    
    Args:
        token_data: Token response data
    """
    try:
        token_file = os.path.join(os.getcwd(), "external_scrapers", "aliexpress_token.json")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(token_file), exist_ok=True)
        
        with open(token_file, 'w') as f:
            json.dump(token_data, f, indent=2)
            
        logger.info(f"Token saved to {token_file}")
        
    except Exception as e:
        logger.error(f"Failed to save token: {str(e)}")
        raise

async def load_token_from_file() -> Optional[Dict[str, Any]]:
    """
    Load token data from file
    
    Returns:
        Token data dictionary or None if not found/invalid
    """
    try:
        token_file = os.path.join(os.getcwd(), "external_scrapers", "aliexpress_token.json")
        
        if os.path.exists(token_file):
            with open(token_file, 'r') as f:
                token_data = json.load(f)
                
            # Check if token is still valid
            if is_token_valid(token_data):
                return token_data
            else:
                logger.info("Saved token is invalid or expired")
                
    except Exception as e:
        logger.error(f"Failed to load token from file: {str(e)}")
        
    return None

def is_token_valid(token_data: Dict[str, Any]) -> bool:
    """
    Check if token is still valid
    
    Args:
        token_data: Token data dictionary
        
    Returns:
        True if token is valid, False otherwise
    """
    if not token_data or "access_token" not in token_data:
        return False
        
    if "expires_at" in token_data:
        try:
            expires_at = datetime.fromisoformat(token_data["expires_at"])
            # Add 5 minute buffer to avoid edge cases
            return datetime.utcnow() < (expires_at - timedelta(minutes=5))
        except:
            return False
            
    return True

async def make_aliexpress_api_call(
    method: str,
    params: Dict[str, Any] = None,
    token: str = None
) -> Dict[str, Any]:
    """
    Make an authenticated call to AliExpress API
    
    Args:
        method: API method name (e.g., 'aliexpress.solution.product.info.get')
        params: API parameters
        token: Access token (if None, will try to load from file)
        
    Returns:
        API response data
        
    Raises:
        Exception: If API call fails
    """
    if not token:
        # Try to load token from file
        token_data = await load_token_from_file()
        if not token_data:
            raise Exception("No valid access token available")
        token = token_data["access_token"]
    
    api_params = {
        "method": method,
        "access_token": token,
        "timestamp": int(datetime.utcnow().timestamp() * 1000),
        "v": "2.0",
        "format": "json"
    }
    
    if params:
        api_params.update(params)
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "SmartLinks-Autopilot/1.0"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info(f"Making AliExpress API call: {method}")
            
            response = await client.post(
                f"{ALIEXPRESS_API_BASE_URL}/sync",
                json=api_params,
                headers=headers
            )
            
            logger.info(f"AliExpress API response status: {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
                logger.error(f"AliExpress API error: {response.status_code} - {error_data}")
                raise Exception(f"AliExpress API call failed: {response.status_code}")
                
    except httpx.TimeoutException:
        logger.error("AliExpress API request timed out")
        raise Exception("AliExpress API request timed out")
        
    except httpx.RequestError as e:
        logger.error(f"AliExpress API request error: {str(e)}")
        raise Exception(f"AliExpress API request failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"Unexpected error during AliExpress API call: {str(e)}")
        raise

def get_oauth_authorization_url(state: str = "default") -> str:
    """
    Generate AliExpress OAuth authorization URL
    
    Args:
        state: State parameter for security
        
    Returns:
        Authorization URL
    """
    callback_url = os.getenv("ALIEXPRESS_CALLBACK_URL", "https://smartlinks.replit.dev/aliexpress/callback")
    
    params = {
        "response_type": "code",
        "client_id": APP_KEY,
        "redirect_uri": callback_url,
        "state": state
    }
    
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    auth_url = f"https://api-sg.aliexpress.com/oauth/authorize?{query_string}"
    
    logger.info(f"Generated OAuth URL: {auth_url}")
    return auth_url