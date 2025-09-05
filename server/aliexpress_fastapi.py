#!/usr/bin/env python3
"""
FastAPI AliExpress OAuth2 Integration
Clean, modular implementation for Replit environment
"""

import os
import json
import httpx
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import urlencode

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AliExpress API Configuration
ALIEXPRESS_TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"
ALIEXPRESS_AUTH_URL = "https://api-sg.aliexpress.com/oauth/authorize"

# Get credentials from Replit Secrets
APP_KEY = os.getenv("ALIEXPRESS_APP_KEY", "518666")
APP_SECRET = os.getenv("ALIEXPRESS_APP_SECRET", "3U2xSKRDIgMH1Vawc2sH8hnZP5QNqywY")
CALLBACK_URL = os.getenv("ALIEXPRESS_CALLBACK_URL", "https://smartlinks.replit.dev/aliexpress/callback")

# Create FastAPI app
app = FastAPI(
    title="SmartLinks AliExpress OAuth",
    description="AliExpress OAuth2 Integration for SmartLinks Autopilot",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "SmartLinks AliExpress OAuth",
        "status": "running",
        "endpoints": [
            "/api/aliexpress/oauth/authorize",
            "/api/aliexpress/exchange_token",
            "/aliexpress/callback"
        ]
    }

@app.get("/api/aliexpress/oauth/authorize")
async def get_oauth_url(state: Optional[str] = Query("smartlinks_oauth")):
    """
    Generate AliExpress OAuth authorization URL
    
    Args:
        state: Optional state parameter for security
        
    Returns:
        Authorization URL
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
            "callback_url": CALLBACK_URL
        }
        
    except Exception as e:
        logger.error(f"Failed to generate OAuth URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate OAuth URL: {str(e)}")

@app.get("/api/aliexpress/exchange_token")
async def exchange_token(code: str = Query(..., description="Authorization code from OAuth callback")):
    """
    Exchange authorization code for access token
    
    Args:
        code: Authorization code from AliExpress OAuth callback
        
    Returns:
        Token information including access_token, refresh_token, expires_in
    """
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is required")
    
    try:
        logger.info(f"Exchanging authorization code: {code[:10]}...")
        
        # Prepare token request
        token_data = {
            "grant_type": "authorization_code",
            "client_id": APP_KEY,
            "client_secret": APP_SECRET,
            "code": code,
            "redirect_uri": CALLBACK_URL
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "SmartLinks-Autopilot/1.0"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info(f"Making token exchange request to: {ALIEXPRESS_TOKEN_URL}")
            
            response = await client.post(
                ALIEXPRESS_TOKEN_URL,
                data=token_data,
                headers=headers
            )
            
            logger.info(f"Token exchange response status: {response.status_code}")
            
            try:
                response_data = response.json()
            except Exception as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                logger.error(f"Response content: {response.text}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Invalid JSON response from AliExpress API: {response.text[:200]}"
                )
            
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
                        raise HTTPException(
                            status_code=400,
                            detail=f"OAuth error: {error_msg}"
                        )
                    else:
                        logger.error(f"No access token in response: {response_data}")
                        raise HTTPException(
                            status_code=500,
                            detail="No access token received from AliExpress"
                        )
            else:
                # HTTP error
                error_msg = f"HTTP {response.status_code}"
                if isinstance(response_data, dict) and "error" in response_data:
                    error_msg += f": {response_data.get('error_description', response_data.get('error'))}"
                
                logger.error(f"Token exchange HTTP error: {error_msg}")
                logger.error(f"Response body: {response_data}")
                
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_msg
                )
                
    except HTTPException:
        # Re-raise FastAPI exceptions
        raise
        
    except httpx.TimeoutException:
        logger.error("Token exchange request timed out")
        raise HTTPException(status_code=408, detail="Request timed out")
        
    except httpx.RequestError as e:
        logger.error(f"Token exchange request error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"Unexpected error during token exchange: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {str(e)}")

@app.get("/aliexpress/callback")
async def oauth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None)
):
    """
    Handle OAuth callback from AliExpress
    
    This endpoint receives the authorization code and redirects to frontend
    """
    try:
        logger.info(f"OAuth callback received - Code: {code[:10] if code else None}, State: {state}, Error: {error}")
        
        # Determine the frontend base URL
        # In production, you might want to configure this differently
        frontend_base = "https://smartlinks.replit.dev/aliexpress"
        
        if error:
            # OAuth error - redirect to frontend with error
            error_params = {
                "auth": "error",
                "error": error,
                "error_description": error_description or "OAuth authentication failed"
            }
            redirect_url = f"{frontend_base}?{urlencode(error_params)}"
            
            logger.error(f"OAuth error: {error} - {error_description}")
            return RedirectResponse(url=redirect_url)
        
        if not code:
            # No code provided - redirect with error
            error_params = {
                "auth": "error",
                "error": "missing_code",
                "error_description": "Authorization code not provided"
            }
            redirect_url = f"{frontend_base}?{urlencode(error_params)}"
            
            logger.error("No authorization code in callback")
            return RedirectResponse(url=redirect_url)
        
        # Success - redirect to frontend with code
        success_params = {
            "auth": "success",
            "code": code,
            "state": state or ""
        }
        redirect_url = f"{frontend_base}?{urlencode(success_params)}"
        
        logger.info(f"Redirecting to frontend with code: {code[:10]}...")
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}")
        
        # Fallback error redirect
        error_params = {
            "auth": "error",
            "error": "callback_error",
            "error_description": "Callback processing failed"
        }
        frontend_base = "https://smartlinks.replit.dev/aliexpress"
        redirect_url = f"{frontend_base}?{urlencode(error_params)}"
        
        return RedirectResponse(url=redirect_url)

@app.get("/api/aliexpress/token/status")
async def get_token_status():
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
        raise HTTPException(status_code=500, detail=f"Failed to check token status: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "SmartLinks AliExpress OAuth",
        "timestamp": datetime.utcnow().isoformat(),
        "configuration": {
            "app_key": APP_KEY,
            "callback_url": CALLBACK_URL,
            "token_url": ALIEXPRESS_TOKEN_URL
        }
    }

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not Found", "message": "The requested resource was not found"}
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(f"Internal server error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "message": "An unexpected error occurred"}
    )

if __name__ == "__main__":
    import uvicorn
    
    # Run the FastAPI server
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8001,  # Use different port than main Express server
        log_level="info"
    )