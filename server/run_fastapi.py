#!/usr/bin/env python3
"""
FastAPI Server Runner for AliExpress OAuth
Runs on port 8001 alongside Express server on port 5000
"""

import uvicorn
import os
from aliexpress_fastapi import app

if __name__ == "__main__":
    print("🚀 Starting SmartLinks AliExpress FastAPI Server...")
    print("📍 Server will be available at: http://0.0.0.0:8001")
    print("🔗 OAuth endpoints:")
    print("   - GET /api/aliexpress/oauth/authorize")
    print("   - GET /api/aliexpress/exchange_token?code=...")
    print("   - GET /aliexpress/callback")
    print("   - GET /health")
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8001,
        log_level="info",
        reload=True  # Auto-reload on file changes
    )