#!/usr/bin/env python3
"""
AliExpress OAuth2 Token Exchange Module
Simplified version for direct integration with Express backend
"""

import os
import sys
import json
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AliExpress API Configuration
ALIEXPRESS_TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"
APP_KEY = os.getenv("ALIEXPRESS_APP_KEY", "518666")
APP_SECRET = os.getenv("ALIEXPRESS_APP_SECRET", "3U2xSKRDIgMH1Vawc2sH8hnZP5QNqywY")
# Determine callback URL from Replit domain or fallback
def get_callback_url():
    # Try to get from environment first
    callback = os.getenv("ALIEXPRESS_CALLBACK_URL")
    if callback:
        return callback
    
    # Try to construct from Replit domains
    replit_domains = os.getenv("REPLIT_DOMAINS", "")
    if replit_domains:
        # Use the first domain from REPLIT_DOMAINS
        primary_domain = replit_domains.split(',')[0].strip()
        return f"https://{primary_domain}/aliexpress/callback"
    
    # Fallback to current domain format
    return "https://smart-links-pilot-lecoinrdc.replit.app/aliexpress/callback"

CALLBACK_URL = get_callback_url()

def exchange_code_for_token(authorization_code: str) -> Dict[str, Any]:
    """
    Exchange authorization code for access token
    
    Args:
        authorization_code: Code received from OAuth callback
        
    Returns:
        Token response dictionary
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
        
        logger.info(f"Making token request to: {ALIEXPRESS_TOKEN_URL}")
        logger.info(f"Request data: {dict(token_data, client_secret='***')}")  # Hide secret in logs
        
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
                
                # Save token to file for persistence
                save_token(response_data)
                
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
                    logger.error(f"No access token in successful response: {response_data}")
                    return {
                        "error": True,
                        "message": "No access token received",
                        "details": response_data
                    }
        else:
            # HTTP error
            error_msg = f"HTTP {response.status_code}"
            if "error" in response_data:
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
        return {"error": True, "message": f"Unexpected error: {str(e)}"}

def save_token(token_data: Dict[str, Any]) -> None:
    """Save token data to file for persistence"""
    try:
        token_file = os.path.join(os.getcwd(), "external_scrapers", "aliexpress_token.json")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(token_file), exist_ok=True)
        
        with open(token_file, 'w') as f:
            json.dump(token_data, f, indent=2)
            
        logger.info(f"Token saved to {token_file}")
        
    except Exception as e:
        logger.error(f"Failed to save token: {str(e)}")

def load_token() -> Optional[Dict[str, Any]]:
    """Load saved token from file"""
    try:
        token_file = os.path.join(os.getcwd(), "external_scrapers", "aliexpress_token.json")
        
        if os.path.exists(token_file):
            with open(token_file, 'r') as f:
                token_data = json.load(f)
                
            # Check if token is still valid
            if is_token_valid(token_data):
                return token_data
            else:
                logger.info("Saved token is expired or invalid")
                
    except Exception as e:
        logger.error(f"Failed to load token: {str(e)}")
        
    return None

def is_token_valid(token_data: Dict[str, Any]) -> bool:
    """Check if token is still valid"""
    if not token_data or "access_token" not in token_data:
        return False
        
    if "expires_at" in token_data:
        try:
            expires_at = datetime.fromisoformat(token_data["expires_at"])
            # Add 5 minute buffer
            return datetime.utcnow() < (expires_at - timedelta(minutes=5))
        except:
            return False
            
    return True

def get_oauth_url() -> str:
    """Generate OAuth authorization URL"""
    params = {
        "response_type": "code",
        "client_id": APP_KEY,
        "redirect_uri": CALLBACK_URL,
        "state": "smartlinks_oauth"
    }
    
    query_params = "&".join([f"{k}={requests.utils.quote(str(v))}" for k, v in params.items()])
    oauth_url = f"https://api-sg.aliexpress.com/oauth/authorize?{query_params}"
    
    logger.info(f"Generated OAuth URL: {oauth_url}")
    return oauth_url

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": True, "message": "Usage: python aliexpress_oauth.py <command> [args]"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == "get_oauth_url":
            url = get_oauth_url()
            print(json.dumps({"oauth_url": url}))
            
        elif command == "exchange_token":
            if len(sys.argv) < 3:
                print(json.dumps({"error": True, "message": "Authorization code required"}))
                sys.exit(1)
                
            code = sys.argv[2]
            result = exchange_code_for_token(code)
            print(json.dumps(result))
            
        elif command == "check_token":
            token_data = load_token()
            if token_data:
                valid = is_token_valid(token_data)
                print(json.dumps({
                    "has_token": True,
                    "valid": valid,
                    "expires_at": token_data.get("expires_at"),
                    "obtained_at": token_data.get("obtained_at")
                }))
            else:
                print(json.dumps({"has_token": False, "valid": False}))
                
        else:
            print(json.dumps({"error": True, "message": f"Unknown command: {command}"}))
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Command failed: {str(e)}")
        print(json.dumps({"error": True, "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()