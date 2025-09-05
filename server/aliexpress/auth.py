#!/usr/bin/env python3
"""
AliExpress OAuth2 Authentication Module
Pure Python implementation for integration with Express backend
FastAPI-ready OAuth implementation with async support
"""

import os
import sys
import json
import requests
import logging
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from urllib.parse import urlencode

# FastAPI imports (optional - only used if FastAPI is available)
try:
    from fastapi import APIRouter, Request
    from fastapi.responses import RedirectResponse, JSONResponse
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AliExpress API Configuration
ALIEXPRESS_TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"
ALIEXPRESS_AUTH_URL = "https://api-sg.aliexpress.com/oauth/authorize"

# Get credentials from Replit Secrets
APP_KEY = os.getenv("ALIEXPRESS_APP_KEY", "518666")
APP_SECRET = os.getenv("ALIEXPRESS_APP_SECRET", "3U2xSKRDIgMH1Vawc2sH8hnZP5QNqywY")
CALLBACK_URL = os.getenv("ALIEXPRESS_CALLBACK_URL", "https://smart-links-pilot-lecoinrdc.replit.app/aliexpress/callback")

class TokenStorage:
    """Simple token storage for development"""
    
    def __init__(self):
        self.token_file = os.path.join(os.getcwd(), "external_scrapers", "aliexpress_token.json")
        os.makedirs(os.path.dirname(self.token_file), exist_ok=True)
    
    def save_token(self, token_data: Dict[str, Any]) -> None:
        """Save token data to file"""
        try:
            with open(self.token_file, 'w') as f:
                json.dump(token_data, f, indent=2)
            logger.info(f"Token saved to {self.token_file}")
        except Exception as e:
            logger.error(f"Failed to save token: {str(e)}")
            raise
    
    def load_token(self) -> Optional[Dict[str, Any]]:
        """Load token data from file"""
        try:
            if os.path.exists(self.token_file):
                with open(self.token_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load token: {str(e)}")
        return None
    
    def is_token_valid(self, token_data: Dict[str, Any]) -> bool:
        """Check if token is still valid"""
        if not token_data or "access_token" not in token_data:
            return False
            
        if "expires_at" in token_data:
            try:
                expires_at = datetime.fromisoformat(token_data["expires_at"])
                return datetime.utcnow() < (expires_at - timedelta(minutes=5))
            except:
                return False
                
        return True

# Global token storage
token_storage = TokenStorage()

def get_oauth_authorization_url(state: str = "smartlinks_oauth") -> Dict[str, Any]:
    """
    Generate AliExpress OAuth authorization URL
    
    Args:
        state: State parameter for security
        
    Returns:
        Dictionary with authorization URL and metadata
    """
    try:
        params = {
            "response_type": "code",
            "client_id": APP_KEY,
            "redirect_uri": CALLBACK_URL,
            "state": state
        }
        
        auth_url = f"{ALIEXPRESS_AUTH_URL}?{urlencode(params)}"
        
        logger.info(f"Generated OAuth URL for state: {state}")
        return {
            "success": True,
            "authorization_url": auth_url,
            "state": state,
            "callback_url": CALLBACK_URL,
            "app_key": APP_KEY
        }
        
    except Exception as e:
        logger.error(f"Failed to generate OAuth URL: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to generate OAuth URL: {str(e)}"
        }

def exchange_code_for_token(authorization_code: str) -> Dict[str, Any]:
    """
    Exchange authorization code for access token
    
    Args:
        authorization_code: Code received from OAuth callback
        
    Returns:
        Token response dictionary including access_token, refresh_token, expires_in
    """
    if not authorization_code:
        return {"error": True, "message": "Authorization code is required"}
    
    try:
        logger.info(f"Exchanging authorization code: {authorization_code[:10]}...")
        
        # Prepare token request
        token_data = {
            "grant_type": "authorization_code",
            "client_id": APP_KEY,
            "client_secret": APP_SECRET,
            "code": authorization_code,
            "redirect_uri": CALLBACK_URL
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "SmartLinks-Autopilot/1.0"
        }
        
        logger.info(f"Making token exchange request to: {ALIEXPRESS_TOKEN_URL}")
        logger.info(f"Request data: {dict(token_data, client_secret='[HIDDEN]')}")
        
        response = requests.post(
            ALIEXPRESS_TOKEN_URL,
            data=token_data,
            headers=headers,
            timeout=30
        )
        
        logger.info(f"Token exchange response status: {response.status_code}")
        logger.info(f"Token exchange response headers: {dict(response.headers)}")
        
        try:
            response_data = response.json()
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {str(e)}")
            logger.error(f"Response content: {response.text}")
            return {
                "error": True,
                "message": f"Invalid JSON response from AliExpress API: {response.text[:200]}"
            }
        
        logger.info(f"Token exchange response data: {response_data}")
        
        if response.status_code == 200:
            # Check if we got an access token
            if "access_token" in response_data:
                # Add timestamp and expiration info
                response_data["obtained_at"] = datetime.utcnow().isoformat()
                
                if "expires_in" in response_data:
                    expires_at = datetime.utcnow() + timedelta(seconds=int(response_data["expires_in"]))
                    response_data["expires_at"] = expires_at.isoformat()
                
                # Save token
                token_storage.save_token(response_data)
                
                logger.info("Token exchange successful")
                return {
                    "success": True,
                    "access_token": response_data["access_token"],
                    "token_type": response_data.get("token_type", "Bearer"),
                    "expires_in": response_data.get("expires_in"),
                    "refresh_token": response_data.get("refresh_token"),
                    "obtained_at": response_data["obtained_at"],
                    "expires_at": response_data.get("expires_at"),
                    "message": "Token exchange successful"
                }
            else:
                # Check for error in response
                if "error" in response_data:
                    error_msg = response_data.get("error_description", response_data.get("error", "Unknown error"))
                    logger.error(f"OAuth error: {error_msg}")
                    return {
                        "error": True,
                        "message": f"OAuth error: {error_msg}",
                        "details": response_data
                    }
                else:
                    logger.error(f"No access token in response: {response_data}")
                    return {
                        "error": True,
                        "message": "No access token received from AliExpress",
                        "details": response_data
                    }
        else:
            # HTTP error
            error_msg = f"HTTP {response.status_code}"
            if isinstance(response_data, dict) and "error" in response_data:
                error_msg += f": {response_data.get('error_description', response_data.get('error'))}"
            
            logger.error(f"Token exchange HTTP error: {error_msg}")
            logger.error(f"Response body: {response_data}")
            
            return {
                "error": True,
                "message": error_msg,
                "status_code": response.status_code,
                "details": response_data
            }
            
    except requests.exceptions.Timeout:
        logger.error("Token exchange request timed out")
        return {"error": True, "message": "Request timed out"}
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Token exchange request error: {str(e)}")
        return {"error": True, "message": f"Request failed: {str(e)}"}
        
    except Exception as e:
        logger.error(f"Unexpected error during token exchange: {str(e)}")
        return {"error": True, "message": f"Token exchange failed: {str(e)}"}

def get_token_status() -> Dict[str, Any]:
    """
    Check current token status
    
    Returns:
        Token status information
    """
    try:
        token_data = token_storage.load_token()
        
        if not token_data:
            return {
                "authenticated": False,
                "has_token": False,
                "message": "No token found"
            }
        
        is_valid = token_storage.is_token_valid(token_data)
        
        return {
            "authenticated": is_valid,
            "has_token": True,
            "token_type": token_data.get("token_type", "Bearer"),
            "obtained_at": token_data.get("obtained_at"),
            "expires_at": token_data.get("expires_at"),
            "expires_in": token_data.get("expires_in"),
            "has_refresh_token": "refresh_token" in token_data,
            "message": "Token is valid" if is_valid else "Token is expired or invalid"
        }
        
    except Exception as e:
        logger.error(f"Failed to check token status: {str(e)}")
        return {
            "error": True,
            "message": f"Failed to check token status: {str(e)}"
        }

def get_access_token() -> Optional[str]:
    """
    Get current valid access token
    
    Returns:
        Access token string or None if not available/valid
    """
    token_data = token_storage.load_token()
    
    if token_data and token_storage.is_token_valid(token_data):
        return token_data.get("access_token")
    
    return None

def handle_callback(code: str, state: str = None) -> Dict[str, Any]:
    """
    Handle OAuth callback with authorization code
    
    Args:
        code: Authorization code from AliExpress
        state: Optional state parameter for validation
        
    Returns:
        Callback handling result with token data or error
    """
    try:
        logger.info(f"Handling OAuth callback - Code: {code[:10]}..., State: {state}")
        
        if not code:
            return {"error": True, "message": "Missing authorization code"}
        
        # Exchange the code for token
        token_result = exchange_code_for_token(code)
        
        if token_result.get("error"):
            logger.error(f"Token exchange failed in callback: {token_result.get('message')}")
            return {
                "error": True,
                "message": "Token exchange failed",
                "details": token_result
            }
        
        logger.info("OAuth callback completed successfully")
        return {
            "success": True,
            "message": "OAuth callback completed successfully",
            "token_data": token_result,
            "redirect_frontend": True
        }
        
    except Exception as e:
        logger.error(f"Callback handling error: {str(e)}")
        return {
            "error": True,
            "message": f"Callback handling failed: {str(e)}"
        }

# FastAPI Router Setup (only if FastAPI is available)
if FASTAPI_AVAILABLE:
    router = APIRouter()
    
    @router.get("/aliexpress/callback")
    async def aliexpress_callback(request: Request):
        """
        FastAPI async callback handler for AliExpress OAuth
        """
        try:
            code = request.query_params.get("code")
            state = request.query_params.get("state")
            error = request.query_params.get("error")
            
            logger.info(f"FastAPI callback received - Code: {code[:10] if code else None}..., State: {state}, Error: {error}")
            
            if not code:
                return JSONResponse(
                    status_code=400, 
                    content={"error": "Missing authorization code"}
                )

            # AliExpress token exchange endpoint
            token_url = "https://api-sg.aliexpress.com/oauth/token"

            payload = {
                "grant_type": "authorization_code",
                "need_refresh_token": "true",
                "client_id": APP_KEY,
                "client_secret": APP_SECRET,
                "code": code,
                "redirect_uri": CALLBACK_URL
            }

            logger.info(f"Making async token exchange request to: {token_url}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(token_url, data=payload)
                
                logger.info(f"Token exchange response status: {response.status_code}")
                
                if response.status_code != 200:
                    logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
                    return JSONResponse(
                        status_code=response.status_code, 
                        content={
                            "error": "Token exchange failed",
                            "details": response.text[:500]
                        }
                    )

                try:
                    token_data = response.json()
                    logger.info("Token exchange successful via FastAPI!")
                    
                    # Save token using our storage class
                    storage = TokenStorage()
                    enhanced_token_data = {
                        "access_token": token_data.get("access_token"),
                        "refresh_token": token_data.get("refresh_token"),
                        "expires_in": token_data.get("expires_in"),
                        "token_type": token_data.get("token_type", "bearer"),
                        "scope": token_data.get("scope"),
                        "obtained_at": datetime.now().isoformat(),
                        "expires_at": (datetime.now() + timedelta(seconds=int(token_data.get("expires_in", 3600)))).isoformat() if token_data.get("expires_in") else None
                    }
                    
                    storage.save_token(enhanced_token_data)
                    
                    return JSONResponse(content={
                        "success": True,
                        "message": "Token exchange completed successfully",
                        "token_data": enhanced_token_data
                    })
                    
                except Exception as json_error:
                    logger.error(f"Failed to parse token response: {json_error}")
                    return JSONResponse(
                        status_code=500,
                        content={
                            "error": "Invalid token response format",
                            "details": str(json_error)
                        }
                    )

        except Exception as e:
            logger.error(f"FastAPI callback exception: {str(e)}")
            return JSONResponse(
                status_code=500, 
                content={
                    "error": "Exception occurred", 
                    "details": str(e)
                }
            )

async def async_exchange_code_for_token(code: str) -> Dict[str, Any]:
    """
    Async version of token exchange using httpx
    """
    try:
        logger.info(f"Async exchanging authorization code: {code[:10]}...")
        
        payload = {
            "grant_type": "authorization_code",
            "client_id": APP_KEY,
            "client_secret": APP_SECRET,
            "code": code,
            "redirect_uri": CALLBACK_URL,
        }
        
        logger.info(f"Making async token exchange request to: {ALIEXPRESS_TOKEN_URL}")
        logger.info(f"Request data: {dict(payload, client_secret='[HIDDEN]')}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(ALIEXPRESS_TOKEN_URL, data=payload)
            
            logger.info(f"Async token exchange response status: {response.status_code}")
            logger.info(f"Async token exchange response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                try:
                    token_data = response.json()
                    
                    # Enhance token data with metadata
                    enhanced_token_data = {
                        "access_token": token_data.get("access_token"),
                        "refresh_token": token_data.get("refresh_token"),
                        "expires_in": token_data.get("expires_in"),
                        "token_type": token_data.get("token_type", "bearer"),
                        "scope": token_data.get("scope"),
                        "obtained_at": datetime.now().isoformat(),
                        "expires_at": (datetime.now() + timedelta(seconds=int(token_data.get("expires_in", 3600)))).isoformat() if token_data.get("expires_in") else None
                    }
                    
                    # Save token
                    storage = TokenStorage()
                    storage.save_token(enhanced_token_data)
                    
                    logger.info("Async token exchange and storage completed successfully!")
                    return enhanced_token_data
                    
                except Exception as json_error:
                    logger.error(f"Failed to parse async JSON response: {json_error}")
                    logger.error(f"Response content: {response.text[:500]}")
                    return {
                        "error": True,
                        "message": f"Invalid JSON response from AliExpress API: {response.text[:200]}"
                    }
            else:
                logger.error(f"Async token exchange failed with status: {response.status_code}")
                logger.error(f"Response: {response.text[:500]}")
                return {
                    "error": True,
                    "message": f"HTTP {response.status_code}: {response.text[:200]}"
                }
                
    except Exception as e:
        logger.error(f"Async token exchange exception: {str(e)}")
        return {
            "error": True,
            "message": f"Token exchange failed: {str(e)}"
        }

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": True, "message": "Usage: python auth.py <command> [args]"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == "get_oauth_url":
            state = sys.argv[2] if len(sys.argv) > 2 else "smartlinks_oauth"
            result = get_oauth_authorization_url(state)
            print(json.dumps(result))
            
        elif command == "exchange_token":
            if len(sys.argv) < 3:
                print(json.dumps({"error": True, "message": "Authorization code required"}))
                sys.exit(1)
                
            code = sys.argv[2]
            result = exchange_code_for_token(code)
            print(json.dumps(result))
            
        elif command == "handle_callback":
            if len(sys.argv) < 3:
                print(json.dumps({"error": True, "message": "Authorization code required"}))
                sys.exit(1)
                
            code = sys.argv[2]
            state = sys.argv[3] if len(sys.argv) > 3 else None
            result = handle_callback(code, state)
            print(json.dumps(result))
            
        elif command == "token_status":
            result = get_token_status()
            print(json.dumps(result))
            
        elif command == "get_access_token":
            token = get_access_token()
            if token:
                print(json.dumps({"access_token": token}))
            else:
                print(json.dumps({"error": True, "message": "No valid access token"}))
        
        elif command == "async_exchange_token":
            if len(sys.argv) < 3:
                print(json.dumps({"error": True, "message": "Authorization code required"}))
                sys.exit(1)
                
            code = sys.argv[2]
            # Run async function
            result = asyncio.run(async_exchange_code_for_token(code))
            print(json.dumps(result))
                
        else:
            print(json.dumps({"error": True, "message": f"Unknown command: {command}"}))
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Command failed: {str(e)}")
        print(json.dumps({"error": True, "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()