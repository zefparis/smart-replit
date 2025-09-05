#!/usr/bin/env python3
"""
AliExpress OAuth Callback Handler
Handles the OAuth callback and redirects to frontend
"""

import os
import sys
import json
import logging
from urllib.parse import parse_qs, urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def handle_callback(callback_url: str) -> dict:
    """
    Parse OAuth callback URL and extract code/error
    
    Args:
        callback_url: Full callback URL with parameters
        
    Returns:
        Dictionary with code, state, error information
    """
    try:
        # Parse the URL
        parsed = urlparse(callback_url)
        query_params = parse_qs(parsed.query)
        
        result = {
            "success": False,
            "code": None,
            "state": None,
            "error": None,
            "error_description": None
        }
        
        # Extract parameters
        if 'code' in query_params:
            result["code"] = query_params['code'][0]
            result["success"] = True
            
        if 'state' in query_params:
            result["state"] = query_params['state'][0]
            
        if 'error' in query_params:
            result["error"] = query_params['error'][0]
            result["success"] = False
            
        if 'error_description' in query_params:
            result["error_description"] = query_params['error_description'][0]
            
        logger.info(f"Callback parsed: success={result['success']}, has_code={bool(result['code'])}")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to parse callback URL: {str(e)}")
        return {
            "success": False,
            "error": "invalid_callback",
            "error_description": f"Failed to parse callback URL: {str(e)}"
        }

def generate_frontend_redirect(result: dict) -> str:
    """
    Generate frontend redirect URL with OAuth result
    
    Args:
        result: OAuth callback parsing result
        
    Returns:
        Frontend redirect URL
    """
    # Determine base URL dynamically
    replit_domains = os.getenv("REPLIT_DOMAINS", "")
    if replit_domains:
        primary_domain = replit_domains.split(',')[0].strip()
        base_url = f"https://{primary_domain}/aliexpress"
    else:
        base_url = "https://smart-links-pilot-lecoinrdc.replit.app/aliexpress"
    
    if result["success"] and result["code"]:
        # Success - redirect to frontend with code
        return f"{base_url}?auth=success&code={result['code']}&state={result.get('state', '')}"
    else:
        # Error - redirect to frontend with error
        error = result.get("error", "unknown_error")
        error_desc = result.get("error_description", "OAuth authentication failed")
        return f"{base_url}?auth=error&error={error}&error_description={error_desc}"

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": True, "message": "Usage: python callback_handler.py <callback_url>"}))
        sys.exit(1)
    
    callback_url = sys.argv[1]
    
    try:
        result = handle_callback(callback_url)
        redirect_url = generate_frontend_redirect(result)
        
        print(json.dumps({
            "callback_result": result,
            "redirect_url": redirect_url
        }))
        
    except Exception as e:
        logger.error(f"Callback handling failed: {str(e)}")
        print(json.dumps({"error": True, "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()