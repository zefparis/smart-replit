#!/usr/bin/env python3
"""
Debug script pour analyser le problème OAuth AliExpress
"""

import requests
import json
import os
from urllib.parse import urlencode, parse_qs, urlparse

def debug_oauth_flow():
    print("🔍 DEBUG OAUTH FLOW ALIEXPRESS")
    print("=" * 45)
    
    # 1. Vérifier l'URL OAuth générée
    print("1. 🔗 Test URL OAuth generation...")
    try:
        response = requests.get("https://smart-links-pilot-lecoinrdc.replit.app/api/aliexpress/oauth/url")
        if response.status_code == 200:
            oauth_data = response.json()
            print(f"   ✅ OAuth URL: {oauth_data.get('oauth_url', 'N/A')[:80]}...")
            print(f"   📝 State: {oauth_data.get('state', 'N/A')}")
            print(f"   🔄 Callback: {oauth_data.get('callback_url', 'N/A')}")
            
            # Analyser les paramètres
            url = oauth_data.get('oauth_url', '')
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            
            print("\n   📊 Paramètres OAuth:")
            for key, value in params.items():
                print(f"      {key}: {value[0] if value else 'N/A'}")
                
        else:
            print(f"   ❌ Erreur: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Exception: {str(e)}")
    
    # 2. Test du callback URL
    print("\n2. 🌐 Test callback URL...")
    callback_url = os.getenv("ALIEXPRESS_CALLBACK_URL", "https://smart-links-pilot-lecoinrdc.replit.app/aliexpress/callback")
    print(f"   URL: {callback_url}")
    
    try:
        response = requests.get(callback_url, allow_redirects=False)
        print(f"   Status: {response.status_code}")
        if response.headers.get('Location'):
            print(f"   Redirect: {response.headers.get('Location')}")
    except Exception as e:
        print(f"   ❌ Exception: {str(e)}")
    
    # 3. Test avec code simulé
    print("\n3. 🧪 Test token exchange avec code simulé...")
    test_url = f"{callback_url}?code=test_oauth_code&state=smartlinks_oauth"
    
    try:
        response = requests.get(test_url, allow_redirects=True)
        print(f"   Status final: {response.status_code}")
        print(f"   URL finale: {response.url}")
        
        # Vérifier si on arrive bien sur la page avec les paramètres
        final_parsed = urlparse(response.url)
        if "auth=error" in final_parsed.query:
            print("   ⚠️  Résultat: Erreur detectée dans callback")
            final_params = parse_qs(final_parsed.query)
            print(f"   Erreur: {final_params.get('error', ['N/A'])[0]}")
            print(f"   Description: {final_params.get('error_description', ['N/A'])[0]}")
        elif "auth=success" in final_parsed.query:
            print("   ✅ Résultat: Succès detecté")
        else:
            print("   ⚠️  Résultat: Status indéterminé")
            
    except Exception as e:
        print(f"   ❌ Exception: {str(e)}")
    
    # 4. Analyser les secrets
    print("\n4. 🔑 Analyse des secrets...")
    secrets = {
        "ALIEXPRESS_APP_KEY": os.getenv("ALIEXPRESS_APP_KEY"),
        "ALIEXPRESS_APP_SECRET": os.getenv("ALIEXPRESS_APP_SECRET"),
        "ALIEXPRESS_CALLBACK_URL": os.getenv("ALIEXPRESS_CALLBACK_URL")
    }
    
    for key, value in secrets.items():
        if value:
            if "SECRET" in key:
                print(f"   ✅ {key}: {'*' * len(value)} ({len(value)} chars)")
            else:
                print(f"   ✅ {key}: {value}")
        else:
            print(f"   ❌ {key}: MANQUANT")
    
    # 5. Recommandations
    print("\n📋 RECOMMANDATIONS:")
    print("=" * 25)
    
    # Vérifier la cohérence callback URL
    env_callback = secrets.get("ALIEXPRESS_CALLBACK_URL", "")
    if "/aliexpress/callback" not in env_callback:
        print("⚠️  PROBLÈME IDENTIFIÉ:")
        print("   L'URL callback doit se terminer par '/aliexpress/callback'")
        print(f"   Actuel: {env_callback}")
        print("   Correct: https://smart-links-pilot-lecoinrdc.replit.app/aliexpress/callback")
        print("\n🔧 SOLUTION:")
        print("   Mettre à jour ALIEXPRESS_CALLBACK_URL dans les secrets Replit")
    else:
        print("✅ URL callback semble correcte")
    
    print("\n💡 Pour tester OAuth réel:")
    print("   1. Corriger l'URL callback si nécessaire")  
    print("   2. Redéployer l'application")
    print("   3. Aller sur /aliexpress → Authentication")
    print("   4. Cliquer 'Authorize SmartLinks with AliExpress'")
    print("   5. Autoriser dans la console AliExpress")

if __name__ == "__main__":
    debug_oauth_flow()