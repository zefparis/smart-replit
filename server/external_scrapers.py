"""
External Scrapers Integration Module for SmartLinks
===================================================

This module provides integration with external scraping tools
for the SmartLinks Autopilot dashboard.
"""

import subprocess
import sys
import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ExternalScrapersManager:
    """Manager for external scraping tools integration"""
    
    def __init__(self):
        # Updated paths based on actual repository structure
        self.scraper_paths = {
            'jobfunnel': 'external_scrapers/repo-jobfunnel/jobfunnel/__main__.py',
            'paper': 'external_scrapers/repo-paper-scraper/paperscraper/__init__.py',
            'scrapfly': 'external_scrapers/repo-scrapfly'
        }
        
        self.scraper_descriptions = {
            'jobfunnel': 'Job aggregation and filtering tool - scrapes Indeed, Monster, Glassdoor',
            'paper': 'Academic paper scraping tool - supports arXiv, PubMed, Google Scholar, bioRxiv, medRxiv',
            'scrapfly': 'Comprehensive scraping collection - 40+ specialized scrapers for e-commerce, social media, real estate'
        }
        
        # Configuration files for each scraper
        self.scraper_configs = {
            'jobfunnel': 'external_scrapers/repo-jobfunnel/demo/settings.yaml',
            'paper': 'external_scrapers/repo-paper-scraper/requirements.txt',
            'scrapfly': 'external_scrapers/repo-scrapfly/README.md'
        }
        
        # Supported features for each scraper
        self.scraper_features = {
            'jobfunnel': ['indeed', 'monster', 'glassdoor', 'job_search'],
            'paper': ['arxiv', 'pubmed', 'scholar', 'biorxiv', 'medrxiv', 'chemrxiv', 'pdf_download', 'citations'],
            'scrapfly': ['amazon', 'ebay', 'aliexpress', 'instagram', 'linkedin', 'twitter', 'reddit', 'booking', 'tripadvisor', 'zillow', 'glassdoor', 'indeed']
        }
        
        # Scrapfly individual scrapers mapping
        self.scrapfly_scrapers = {
            'amazon': 'amazon-scraper',
            'aliexpress': 'aliexpress-scraper', 
            'booking': 'bookingcom-scraper',
            'crunchbase': 'crunchbase-scraper',
            'ebay': 'ebay-scraper',
            'etsy': 'etsy-scraper',
            'glassdoor': 'glassdoor-scraper',
            'google': 'google-scraper',
            'indeed': 'indeed-scraper',
            'instagram': 'instagram-scraper',
            'linkedin': 'linkedin-scraper',
            'nordstrom': 'nordstorm-scraper',
            'reddit': 'reddit-scraper',
            'redfin': 'redfin-scraper',
            'rightmove': 'rightmove-scraper',
            'stockx': 'stockx-scraper',
            'threads': 'threads-scraper',
            'tiktok': 'tiktok-scraper',
            'tripadvisor': 'tripadvisor-scraper',
            'trustpilot': 'trustpilot-scraper',
            'twitter': 'twitter-scraper',
            'walmart': 'walmart-scraper',
            'yelp': 'yelp-scraper',
            'zillow': 'zillow-scraper'
        }
    
    def list_scrapers(self) -> Dict[str, str]:
        """List all available scrapers with descriptions"""
        available = {}
        for name, description in self.scraper_descriptions.items():
            if self.is_scraper_available(name):
                available[name] = description
        return available
    
    def is_scraper_available(self, name: str) -> bool:
        """Check if a scraper is available and properly installed"""
        path = self.scraper_paths.get(name)
        if not path:
            return False
        
        # Check if the path exists
        if not os.path.exists(path):
            return False
        
        return True
    
    def get_scraper_info(self, name: str) -> Dict[str, Any]:
        """Get detailed information about a specific scraper"""
        if name not in self.scraper_descriptions:
            return {"error": "Scraper not found"}
        
        info = {
            "name": name,
            "description": self.scraper_descriptions[name],
            "path": self.scraper_paths.get(name, ""),
            "available": self.is_scraper_available(name),
            "status": "active" if self.is_scraper_available(name) else "inactive",
            "config_file": self.scraper_configs.get(name)
        }
        
        # Add specific information for each scraper
        if name == 'jobfunnel' and self.is_scraper_available(name):
            info.update({
                "supported_sites": ["Indeed", "Monster", "Glassdoor"],
                "config_examples": [
                    "external_scrapers/repo-jobfunnel/demo/settings.yaml",
                    "external_scrapers/repo-jobfunnel/demo/settings_USA.yaml",
                    "external_scrapers/repo-jobfunnel/demo/settings_FR.yaml"
                ],
                "usage": "python -m jobfunnel --config_file settings.yaml",
                "features": self.scraper_features.get(name, [])
            })
        elif name == 'paper' and self.is_scraper_available(name):
            info.update({
                "supported_sources": ["arXiv", "PubMed", "Google Scholar", "bioRxiv", "medRxiv", "ChemRxiv"],
                "capabilities": [
                    "Search academic papers",
                    "Download PDFs",
                    "Extract citations",
                    "Get paper dumps",
                    "Impact analysis"
                ],
                "usage": "from paperscraper import search_papers",
                "features": self.scraper_features.get(name, [])
            })
        elif name == 'scrapfly' and self.is_scraper_available(name):
            info.update({
                "supported_platforms": [
                    "E-commerce: Amazon, eBay, AliExpress, Etsy, Nordstrom, StockX",
                    "Social Media: Instagram, LinkedIn, Twitter, Reddit, Threads, TikTok", 
                    "Real Estate: Zillow, Redfin, RightMove, Booking.com",
                    "Business: Glassdoor, Indeed, Crunchbase, TrustPilot, Yelp",
                    "Search: Google, Bing"
                ],
                "total_scrapers": len(self.scrapfly_scrapers),
                "usage": "python run.py --help",
                "features": self.scraper_features.get(name, [])
            })
        
        return info
    
    def run_scraper(self, name: str, args: List[str] = None, 
                   capture_output: bool = True, timeout: int = 60) -> Dict[str, Any]:
        """
        Execute a scraper with given arguments
        
        Args:
            name: Scraper name
            args: Command line arguments
            capture_output: Whether to capture output
            timeout: Execution timeout in seconds
            
        Returns:
            Dict with execution results
        """
        if args is None:
            args = []
        
        path = self.scraper_paths.get(name)
        if not path or not self.is_scraper_available(name):
            return {
                "success": False,
                "error": f"Scraper '{name}' not available",
                "output": "",
                "stderr": ""
            }
        
        try:
            # Special handling for different scrapers
            if name == 'jobfunnel':
                # Change to the jobfunnel directory for proper execution
                jobfunnel_dir = os.path.dirname(path)
                cmd = [sys.executable, '-m', 'jobfunnel'] + args
                logger.info(f"Executing JobFunnel: {' '.join(cmd)} in {jobfunnel_dir}")
                working_dir = jobfunnel_dir
                
            elif name == 'paper':
                # Paper scraper is a Python package, execute with -c for imports
                paper_dir = os.path.dirname(path)
                if args and args[0] == '--help':
                    cmd = [sys.executable, '-c', 
                           'import paperscraper; help(paperscraper)']
                else:
                    # For paper scraper, create a simple test script
                    cmd = [sys.executable, '-c', 
                           'import paperscraper; print("Paper scraper available. Modules:", dir(paperscraper))']
                logger.info(f"Executing Paper Scraper: {' '.join(cmd)} in {paper_dir}")
                working_dir = paper_dir
                
            elif name == 'scrapfly':
                # Scrapfly collection - test if directory exists and show available scrapers
                scrapfly_dir = path
                if args and args[0] == '--help':
                    cmd = [sys.executable, '-c', f'''
import os
import json
scrapfly_dir = "{scrapfly_dir}"
if os.path.exists(scrapfly_dir):
    scrapers = [d for d in os.listdir(scrapfly_dir) if os.path.isdir(os.path.join(scrapfly_dir, d)) and d.endswith("-scraper")]
    print(f"Scrapfly Collection Available")
    print(f"Total scrapers found: {{len(scrapers)}}")
    print("Available scrapers:")
    for scraper in sorted(scrapers):
        print(f"  - {{scraper}}")
else:
    print("Scrapfly directory not found")
                    ''']
                else:
                    # List available scrapers
                    cmd = [sys.executable, '-c', f'''
import os
scrapfly_dir = "{scrapfly_dir}"
if os.path.exists(scrapfly_dir):
    scrapers = [d for d in os.listdir(scrapfly_dir) if os.path.isdir(os.path.join(scrapfly_dir, d)) and d.endswith("-scraper")]
    print(f"{{len(scrapers)}} scrapers available in Scrapfly collection")
else:
    print("Scrapfly collection not found")
                    ''']
                logger.info(f"Executing Scrapfly Collection: {' '.join(cmd)}")
                working_dir = scrapfly_dir
                
            else:
                # Standard execution for other scrapers
                cmd = [sys.executable, path] + args
                logger.info(f"Executing: {' '.join(cmd)}")
                working_dir = os.getcwd()
            
            if capture_output:
                result = subprocess.run(
                    cmd, 
                    capture_output=True, 
                    text=True, 
                    timeout=timeout,
                    cwd=working_dir
                )
            else:
                result = subprocess.run(cmd, timeout=timeout, cwd=working_dir)
            
            return {
                "success": result.returncode == 0,
                "returncode": result.returncode,
                "output": result.stdout if capture_output else "Output not captured",
                "stderr": result.stderr if capture_output else "",
                "command": ' '.join(cmd),
                "working_directory": working_dir
            }
                
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": f"Scraper execution timed out after {timeout} seconds",
                "output": "",
                "stderr": ""
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "output": "",
                "stderr": ""
            }
    
    def batch_execute(self, scraper_configs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Execute multiple scrapers in batch"""
        results = {}
        
        for config in scraper_configs:
            name = config.get('name')
            args = config.get('args', [])
            timeout = config.get('timeout', 30)
            
            if not name:
                continue
                
            results[name] = self.run_scraper(name, args, timeout=timeout)
        
        return results
    
    def check_dependencies(self) -> Dict[str, Any]:
        """Check if required dependencies are installed"""
        dependencies_status = {}
        
        # Check Python
        dependencies_status['python'] = {
            'available': True,
            'version': sys.version,
            'path': sys.executable
        }
        
        # Check individual scrapers
        for name in self.scraper_paths:
            dependencies_status[name] = {
                'available': self.is_scraper_available(name),
                'path': self.scraper_paths[name]
            }
        
        return dependencies_status
    
    def install_dependencies(self) -> Dict[str, Any]:
        """Install required dependencies for scrapers"""
        results = {}
        
        # Try to install requirements for each scraper
        for name, path in self.scraper_paths.items():
            scraper_dir = os.path.dirname(path)
            
            # Look for different dependency files
            dependency_files = [
                os.path.join(scraper_dir, 'requirements.txt'),
                os.path.join(scraper_dir, 'pyproject.toml'),
                os.path.join(scraper_dir, 'setup.py')
            ]
            
            installed = False
            for dep_file in dependency_files:
                if os.path.exists(dep_file):
                    try:
                        if dep_file.endswith('requirements.txt'):
                            cmd = [sys.executable, '-m', 'pip', 'install', '-r', dep_file]
                        elif dep_file.endswith('pyproject.toml'):
                            cmd = [sys.executable, '-m', 'pip', 'install', '-e', scraper_dir]
                        elif dep_file.endswith('setup.py'):
                            cmd = [sys.executable, '-m', 'pip', 'install', '-e', scraper_dir]
                        
                        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                        
                        results[name] = {
                            'success': result.returncode == 0,
                            'output': result.stdout,
                            'stderr': result.stderr,
                            'dependency_file': dep_file
                        }
                        installed = True
                        break
                        
                    except Exception as e:
                        results[name] = {
                            'success': False,
                            'error': str(e),
                            'dependency_file': dep_file
                        }
            
            if not installed:
                results[name] = {
                    'success': False,
                    'error': 'No dependency files found (requirements.txt, pyproject.toml, setup.py)'
                }
        
        return results
    
    def get_jobfunnel_help(self) -> Dict[str, Any]:
        """Get JobFunnel help and usage information"""
        return self.run_scraper('jobfunnel', ['--help'], timeout=10)
    
    def run_jobfunnel_with_config(self, config_path: str = None) -> Dict[str, Any]:
        """Run JobFunnel with a specific configuration file"""
        if not config_path:
            config_path = self.scraper_configs.get('jobfunnel')
        
        if not config_path or not os.path.exists(config_path):
            return {
                "success": False,
                "error": f"Configuration file not found: {config_path}"
            }
        
        return self.run_scraper('jobfunnel', ['--config_file', config_path], timeout=300)
    
    def get_paper_scraper_info(self) -> Dict[str, Any]:
        """Get Paper Scraper capabilities and usage information"""
        return self.run_scraper('paper', ['--help'], timeout=10)
    
    def test_paper_scraper_modules(self) -> Dict[str, Any]:
        """Test Paper Scraper module availability"""
        if not self.is_scraper_available('paper'):
            return {
                "success": False,
                "error": "Paper scraper not available"
            }
        
        paper_dir = os.path.dirname(self.scraper_paths['paper'])
        cmd = [sys.executable, '-c', '''
import sys
import os
sys.path.insert(0, os.getcwd())

try:
    import paperscraper
    print("✓ paperscraper module imported successfully")
    
    # Test main modules
    modules = {}
    try:
        from paperscraper import arxiv
        modules["arxiv"] = "Available"
    except Exception as e:
        modules["arxiv"] = f"Error: {e}"
    
    try:
        from paperscraper import pubmed
        modules["pubmed"] = "Available"
    except Exception as e:
        modules["pubmed"] = f"Error: {e}"
    
    try:
        from paperscraper import scholar
        modules["scholar"] = "Available"
    except Exception as e:
        modules["scholar"] = f"Error: {e}"
    
    try:
        from paperscraper import pdf
        modules["pdf"] = "Available"
    except Exception as e:
        modules["pdf"] = f"Error: {e}"
    
    print("Modules status:")
    for module, status in modules.items():
        print(f"  {module}: {status}")
        
except ImportError as e:
    print(f"✗ Failed to import paperscraper: {e}")
    print("Available modules in directory:")
    import os
    for item in os.listdir("."):
        if os.path.isdir(item) and not item.startswith("."):
            print(f"  - {item}")
        ''']
        
        try:
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=30,
                cwd=paper_dir
            )
            
            return {
                "success": result.returncode == 0,
                "returncode": result.returncode,
                "output": result.stdout,
                "stderr": result.stderr,
                "command": "Paper scraper module test",
                "working_directory": paper_dir
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_scrapfly_scrapers(self) -> Dict[str, Any]:
        """Get list of available Scrapfly scrapers"""
        if not self.is_scraper_available('scrapfly'):
            return {
                "success": False,
                "error": "Scrapfly collection not available"
            }
        
        scrapfly_dir = self.scraper_paths['scrapfly']
        try:
            scrapers = []
            if os.path.exists(scrapfly_dir):
                for item in os.listdir(scrapfly_dir):
                    item_path = os.path.join(scrapfly_dir, item)
                    if os.path.isdir(item_path) and item.endswith('-scraper'):
                        run_py = os.path.join(item_path, 'run.py')
                        if os.path.exists(run_py):
                            scrapers.append({
                                "name": item,
                                "path": run_py,
                                "platform": item.replace('-scraper', '').title()
                            })
            
            return {
                "success": True,
                "scrapers": scrapers,
                "total": len(scrapers),
                "working_directory": scrapfly_dir
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def run_scrapfly_scraper(self, scraper_name: str, args: List[str] = None) -> Dict[str, Any]:
        """Run a specific Scrapfly scraper"""
        if scraper_name not in self.scrapfly_scrapers:
            return {
                "success": False,
                "error": f"Unknown Scrapfly scraper: {scraper_name}"
            }
        
        scraper_dir = self.scrapfly_scrapers[scraper_name]
        scraper_path = os.path.join(self.scraper_paths['scrapfly'], scraper_dir, 'run.py')
        
        if not os.path.exists(scraper_path):
            return {
                "success": False,
                "error": f"Scraper not found: {scraper_path}"
            }
        
        cmd = [sys.executable, scraper_path] + (args or [])
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
                cwd=os.path.dirname(scraper_path)
            )
            
            return {
                "success": result.returncode == 0,
                "returncode": result.returncode,
                "output": result.stdout,
                "stderr": result.stderr,
                "command": ' '.join(cmd),
                "working_directory": os.path.dirname(scraper_path)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# Global instance
external_scrapers_manager = ExternalScrapersManager()

# API functions for use in routes
def list_external_scrapers():
    """API function to list external scrapers"""
    return external_scrapers_manager.list_scrapers()

def get_external_scraper_info(name: str):
    """API function to get scraper info"""
    return external_scrapers_manager.get_scraper_info(name)

def run_external_scraper(name: str, args: List[str] = None):
    """API function to run external scraper"""
    return external_scrapers_manager.run_scraper(name, args or [])

def check_external_dependencies():
    """API function to check dependencies"""
    return external_scrapers_manager.check_dependencies()

def install_external_dependencies():
    """API function to install dependencies"""
    return external_scrapers_manager.install_dependencies()