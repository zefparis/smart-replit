#!/usr/bin/env python3
"""
Script pour identifier et corriger les éléments manquants
dans l'intégration AliExpress OAuth2
"""

import os
import json
import requests
from datetime import datetime

def check_missing_elements():
    """Vérifie tous les éléments manquants"""
    
    print("🔍 DIAGNOSTIC COMPLET - Éléments Manquants")
    print("=" * 50)
    
    missing_elements = []
    
    # 1. Vérification des secrets
    print("1. Vérification des secrets Replit...")
    secrets = {
        "ALIEXPRESS_APP_KEY": os.getenv("ALIEXPRESS_APP_KEY"),
        "ALIEXPRESS_APP_SECRET": os.getenv("ALIEXPRESS_APP_SECRET"),
        "ALIEXPRESS_CALLBACK_URL": os.getenv("ALIEXPRESS_CALLBACK_URL")
    }
    
    for key, value in secrets.items():
        if value:
            if key == "ALIEXPRESS_APP_SECRET":
                print(f"   ✅ {key}: {'*' * len(value)}")
            else:
                print(f"   ✅ {key}: {value}")
        else:
            print(f"   ❌ {key}: MANQUANT")
            missing_elements.append(f"Secret {key}")
    
    # 2. Vérification du token stocké
    print("\n2. Vérification du token stocké...")
    token_file = "external_scrapers/aliexpress_token.json"
    
    if os.path.exists(token_file):
        try:
            with open(token_file, 'r') as f:
                token_data = json.load(f)
            print("   ✅ Token trouvé")
            print(f"   📅 Obtenu: {token_data.get('obtained_at', 'N/A')}")
            print(f"   🔑 Access token: {token_data.get('access_token', 'N/A')[:20]}..." if token_data.get('access_token') else "   🔑 Access token: MANQUANT")
        except Exception as e:
            print(f"   ❌ Erreur lecture token: {str(e)}")
            missing_elements.append("Token valide")
    else:
        print("   ❌ Fichier token non trouvé")
        missing_elements.append("Fichier token")
    
    # 3. Test des endpoints backend
    print("\n3. Test des endpoints backend...")
    base_url = "http://localhost:5000"
    
    endpoints = [
        ("/api/aliexpress/status", "Status"),
        ("/api/aliexpress/oauth/url", "OAuth URL"),
        ("/aliexpress/callback", "Callback")
    ]
    
    for endpoint, name in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code in [200, 302]:
                print(f"   ✅ {name}: OK ({response.status_code})")
            else:
                print(f"   ⚠️  {name}: {response.status_code}")
        except Exception as e:
            print(f"   ❌ {name}: Erreur - {str(e)}")
            missing_elements.append(f"Endpoint {name}")
    
    # 4. Vérification URL callback externe
    print("\n4. Vérification URL callback externe...")
    callback_url = secrets.get("ALIEXPRESS_CALLBACK_URL")
    
    if callback_url:
        try:
            # Test simple de l'URL (devrait rediriger)
            response = requests.get(callback_url, timeout=10, allow_redirects=False)
            if response.status_code in [200, 302, 400]:  # 400 normal sans code
                print(f"   ✅ URL callback accessible: {response.status_code}")
            else:
                print(f"   ⚠️  URL callback: {response.status_code}")
                missing_elements.append("URL callback accessible")
        except Exception as e:
            print(f"   ❌ URL callback: Erreur - {str(e)}")
            missing_elements.append("URL callback fonctionnelle")
    
    # 5. Vérification des dépendances Python
    print("\n5. Vérification des dépendances Python...")
    dependencies = ["requests", "httpx", "fastapi"]
    
    for dep in dependencies:
        try:
            __import__(dep)
            print(f"   ✅ {dep}: Disponible")
        except ImportError:
            if dep == "fastapi":
                print(f"   ⚠️  {dep}: Non disponible (optionnel)")
            else:
                print(f"   ❌ {dep}: MANQUANT")
                missing_elements.append(f"Dépendance {dep}")
    
    # 6. Résumé
    print(f"\n📊 RÉSUMÉ DU DIAGNOSTIC")
    print("=" * 30)
    
    if not missing_elements:
        print("🎉 AUCUN ÉLÉMENT MANQUANT - Intégration complète!")
        print("\n🚀 Prêt pour test d'authentification réelle:")
        print("   1. Aller sur /aliexpress")
        print("   2. Cliquer 'Authorize SmartLinks with AliExpress'")
        print("   3. Observer le flux OAuth complet")
        
    else:
        print(f"⚠️  {len(missing_elements)} élément(s) manquant(s):")
        for i, element in enumerate(missing_elements, 1):
            print(f"   {i}. {element}")
            
        print("\n🔧 Actions recommandées:")
        
        if "Fichier token" in missing_elements:
            print("   → Effectuer une authentification OAuth réelle")
        
        if any("URL callback" in elem for elem in missing_elements):
            print("   → Vérifier/corriger l'URL callback dans les secrets")
            
        if any("Endpoint" in elem for elem in missing_elements):
            print("   → Redémarrer le serveur Express")
            
        if any("Secret" in elem for elem in missing_elements):
            print("   → Configurer les secrets manquants dans Replit")
    
    return missing_elements

def create_token_placeholder():
    """Crée un token placeholder pour les tests"""
    print("\n🔧 Création d'un token placeholder pour les tests...")
    
    token_dir = "external_scrapers"
    os.makedirs(token_dir, exist_ok=True)
    
    placeholder_token = {
        "access_token": None,
        "refresh_token": None,
        "expires_in": None,
        "token_type": "bearer",
        "scope": None,
        "obtained_at": None,
        "expires_at": None,
        "status": "placeholder",
        "note": "Token placeholder - authentification requise"
    }
    
    token_file = os.path.join(token_dir, "aliexpress_token.json")
    
    try:
        with open(token_file, 'w') as f:
            json.dump(placeholder_token, f, indent=2)
        print(f"   ✅ Token placeholder créé: {token_file}")
    except Exception as e:
        print(f"   ❌ Erreur création placeholder: {str(e)}")

if __name__ == "__main__":
    missing = check_missing_elements()
    
    if "Fichier token" in missing:
        create_token_placeholder()
        
    print(f"\n🎯 PROCHAINE ÉTAPE RECOMMANDÉE:")
    if not missing:
        print("   Test d'authentification OAuth réelle sur /aliexpress")
    else:
        print("   Corriger les éléments manquants puis tester OAuth")