#!/usr/bin/env python3
"""
AliExpress FastAPI Standalone Implementation
Implémentation pure FastAPI du callback OAuth comme demandé
"""

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, JSONResponse
import os
import httpx
import json
import logging
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI Router
router = APIRouter()

@router.get("/aliexpress/callback")
async def aliexpress_callback(request: Request):
    """
    FastAPI callback handler exactement comme demandé dans le prompt
    """
    try:
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        error = request.query_params.get("error")
        
        logger.info(f"FastAPI AliExpress callback - Code: {code[:10] if code else None}..., State: {state}, Error: {error}")
        
        if not code:
            return JSONResponse(status_code=400, content={"error": "Missing authorization code."})

        # AliExpress token exchange endpoint
        token_url = "https://api-sg.aliexpress.com/oauth/token"

        payload = {
            "grant_type": "authorization_code",
            "need_refresh_token": "true",
            "client_id": os.getenv("ALIEXPRESS_APP_KEY"),
            "client_secret": os.getenv("ALIEXPRESS_APP_SECRET"),
            "code": code,
            "redirect_uri": os.getenv("ALIEXPRESS_CALLBACK_URL")
        }

        logger.info(f"Making FastAPI token exchange request to: {token_url}")
        logger.info(f"Payload: {dict(payload, client_secret='[HIDDEN]')}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(token_url, data=payload)
                
                logger.info(f"FastAPI token exchange response status: {response.status_code}")
                logger.info(f"FastAPI response headers: {dict(response.headers)}")
                
                if response.status_code != 200:
                    logger.error(f"Token exchange failed: {response.status_code}")
                    logger.error(f"Response text: {response.text[:500]}")
                    return JSONResponse(status_code=response.status_code, content={
                        "error": "Token exchange failed",
                        "details": response.text[:500]
                    })

                token_data = response.json()
                
                # 🔐 DEBUG: tu peux ici logger ou stocker les tokens si tu veux les réutiliser
                logger.info("Token exchange successful via FastAPI!")
                logger.info(f"Token data keys: {list(token_data.keys())}")
                
                # Optionnel: sauvegarder le token
                save_token_to_file(token_data, code, state)
                
                return token_data

        except httpx.TimeoutException:
            logger.error("FastAPI token exchange timeout")
            return JSONResponse(status_code=408, content={
                "error": "Token exchange timeout",
                "details": "Request to AliExpress API timed out"
            })

    except Exception as e:
        logger.error(f"FastAPI callback exception: {str(e)}")
        return JSONResponse(status_code=500, content={"error": "Exception occurred", "details": str(e)})

def save_token_to_file(token_data, code, state):
    """
    Sauvegarde optionnelle du token pour réutilisation
    """
    try:
        token_file = os.path.join(os.getcwd(), "external_scrapers", "aliexpress_token_fastapi.json")
        os.makedirs(os.path.dirname(token_file), exist_ok=True)
        
        enhanced_token = {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in"),
            "token_type": token_data.get("token_type", "bearer"),
            "scope": token_data.get("scope"),
            "obtained_at": datetime.now().isoformat(),
            "code_used": code[:10] + "..." if code else None,
            "state": state,
            "via": "fastapi_callback"
        }
        
        with open(token_file, 'w') as f:
            json.dump(enhanced_token, f, indent=2)
            
        logger.info(f"Token sauvegardé dans: {token_file}")
        
    except Exception as e:
        logger.error(f"Erreur sauvegarde token: {str(e)}")

# Test du module FastAPI
async def test_fastapi_callback():
    """
    Test simulé du callback FastAPI
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    
    app = FastAPI()
    app.include_router(router)
    
    client = TestClient(app)
    
    # Test sans code
    response = client.get("/aliexpress/callback")
    assert response.status_code == 400
    print("✅ Test sans code: OK")
    
    # Test avec code (simulé)
    response = client.get("/aliexpress/callback?code=test_code&state=test_state")
    print(f"🔄 Test avec code: {response.status_code}")
    print(f"Response: {response.json()}")

if __name__ == "__main__":
    # Test en mode standalone
    import asyncio
    
    print("🚀 Test AliExpress FastAPI Callback")
    print("=" * 40)
    
    # Vérification des variables d'environnement
    app_key = os.getenv("ALIEXPRESS_APP_KEY")
    app_secret = os.getenv("ALIEXPRESS_APP_SECRET") 
    callback_url = os.getenv("ALIEXPRESS_CALLBACK_URL")
    
    print(f"App Key: {app_key}")
    print(f"App Secret: {'*' * len(app_secret) if app_secret else None}")
    print(f"Callback URL: {callback_url}")
    
    if app_key and app_secret and callback_url:
        print("✅ Variables d'environnement configurées")
        print("\n🎯 Route FastAPI prête:")
        print("→ @router.get('/aliexpress/callback')")  
        print("→ Échange automatique de tokens via httpx")
        print("→ Gestion d'erreurs complète")
        print("→ Sauvegarde optionnelle des tokens")
        
        try:
            asyncio.run(test_fastapi_callback())
        except ImportError:
            print("⚠️  TestClient non disponible - tests manuels seulement")
            
    else:
        print("❌ Variables d'environnement manquantes")
        
    print("\n📝 Pour utiliser dans main.py:")
    print("""
from fastapi import FastAPI
from server.aliexpress_fastapi_standalone import router as aliexpress_router

app = FastAPI()
app.include_router(aliexpress_router)
""")