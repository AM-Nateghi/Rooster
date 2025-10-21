#!/usr/bin/env python3
"""
Production Deployment Script for Rooster Data Prepare Tool
Cross-platform compatible deployment script
"""

import shutil
import sys
from pathlib import Path
import zipfile
from datetime import datetime
import platform

# Project structure
REQUIRED_FILES = ["main.py", "index.html", "graph.html", "requirements.txt"]

REQUIRED_DIRS = [
    "assets",
]

OPTIONAL_DIRS = ["json_data", "backups"]

PORT = 8014

# Deployment directory
DEPLOY_DIR = Path(".deploy")


def ensure_deploy_dir():
    """Ensure .deploy directory exists"""
    DEPLOY_DIR.mkdir(exist_ok=True)
    print(f"✓ Using deployment directory: {DEPLOY_DIR}")


def create_requirements():
    """Create requirements.txt if it doesn't exist"""
    ensure_deploy_dir()
    requirements = """fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
"""

    requirements_path = DEPLOY_DIR / "requirements.txt"
    requirements_path.write_text(requirements, encoding='utf-8')
    print(f"✓ Created {requirements_path}")


def create_production_config():
    """Create production configuration file"""
    ensure_deploy_dir()
    config = f"""# Production Configuration
import os

# Server settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", {PORT}))
WORKERS = int(os.getenv("WORKERS", 4))

# Security
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_DATA_DIR = os.path.join(BASE_DIR, "json_data")
BACKUPS_DIR = os.path.join(BASE_DIR, "backups")
"""

    config_path = DEPLOY_DIR / "config.py"
    config_path.write_text(config, encoding='utf-8')
    print(f"✓ Created {config_path}")


def create_run_script():
    """Create production run script"""
    ensure_deploy_dir()
    run_script = f'''#!/usr/bin/env python3
"""
Production Runner for Rooster Data Prepare Tool
"""

import uvicorn
import sys
import os

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Import config
    try:
        import config
    except ImportError:
        # Default values if config doesn't exist
        class config:
            HOST = "0.0.0.0"
            PORT = {PORT}
            WORKERS = 4

    # Run the server
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        workers=config.WORKERS,
        log_level="info",
        access_log=True
    )
'''

    run_script_path = DEPLOY_DIR / "run_production.py"
    run_script_path.write_text(run_script, encoding='utf-8')

    # Make it executable on Unix systems (safe on Windows - will just be ignored)
    if platform.system() != "Windows":
        try:
            run_script_path.chmod(0o755)
        except Exception:
            pass

    print(f"✓ Created {run_script_path}")


def create_systemd_service():
    """Create systemd service file for Linux servers"""
    ensure_deploy_dir()
    service_content = """[Unit]
Description=Rooster Data Prepare Tool
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/app
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/bin/python3 /path/to/your/app/run_production.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
"""

    service_path = DEPLOY_DIR / "rooster.service"
    service_path.write_text(service_content, encoding='utf-8')

    print(f"✓ Created {service_path}")
    print("  Note: Update paths in the service file before using!")


def create_docker_files():
    """Create Docker files for containerized deployment"""
    ensure_deploy_dir()

    dockerfile = f"""FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY main.py .
COPY config.py .
COPY run_production.py .
COPY index.html .
COPY graph.html .
COPY assets/ assets/

# Create necessary directories
RUN mkdir -p json_data backups

# Expose port
EXPOSE {PORT}

# Run the application
CMD ["python", "run_production.py"]
"""

    dockerignore = """__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.venv
pip-log.txt
pip-delete-this-directory.txt
.tox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.log
.git
.gitignore
.mypy_cache
.pytest_cache
.hypothesis
.vscode
.idea
*.swp
*.swo
*~
.DS_Store
"""

    docker_compose = f"""version: '3.8'

services:
  rooster:
    build: .
    ports:
      - "{PORT}:{PORT}"
    volumes:
      - ./json_data:/app/json_data
      - ./backups:/app/backups
    environment:
      - HOST=0.0.0.0
      - PORT={PORT}
      - WORKERS=4
    restart: unless-stopped
"""

    dockerfile_path = DEPLOY_DIR / "Dockerfile"
    dockerfile_path.write_text(dockerfile, encoding='utf-8')

    dockerignore_path = DEPLOY_DIR / ".dockerignore"
    dockerignore_path.write_text(dockerignore, encoding='utf-8')

    docker_compose_path = DEPLOY_DIR / "docker-compose.yml"
    docker_compose_path.write_text(docker_compose, encoding='utf-8')

    print(f"✓ Created Docker files in {DEPLOY_DIR}/")


def create_nginx_config():
    """Create nginx configuration for reverse proxy"""
    ensure_deploy_dir()
    nginx_config = f"""server {{
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    # return 301 https://$server_name$request_uri;

    location / {{
        proxy_pass http://127.0.0.1:{PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }}

    # Static files optimization (optional)
    location /assets {{
        proxy_pass http://127.0.0.1:{PORT}/assets;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }}
}}"""
    nginx_path = DEPLOY_DIR / "nginx.conf"
    nginx_path.write_text(nginx_config, encoding='utf-8')

    print(f"✓ Created {nginx_path}")


def create_setup_script():
    """Create setup scripts for easy deployment (both Unix and Windows)"""
    ensure_deploy_dir()

    # Unix/Linux/macOS setup script
    setup_script_unix = """#!/bin/bash
# Setup script for Rooster Data Prepare Tool

echo "Setting up Rooster Data Prepare Tool..."

# Check Python version
python3 --version

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
mkdir -p json_data backups

echo "✓ Setup complete!"
echo ""
echo "To run the application:"
echo "  1. Activate virtual environment: source venv/bin/activate"
echo "  2. Run production server: python run_production.py"
echo ""
echo "Or use Docker:"
echo "  docker-compose up -d"
"""

    # Windows setup script
    setup_script_windows = """@echo off
REM Setup script for Rooster Data Prepare Tool

echo Setting up Rooster Data Prepare Tool...

REM Check Python version
python --version

REM Create virtual environment
echo Creating virtual environment...
python -m venv venv

REM Activate virtual environment
call venv\\Scripts\\activate.bat

REM Upgrade pip
python -m pip install --upgrade pip

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Create necessary directories
if not exist json_data mkdir json_data
if not exist backups mkdir backups

echo.
echo Setup complete!
echo.
echo To run the application:
echo   1. Activate virtual environment: venv\\Scripts\\activate.bat
echo   2. Run production server: python run_production.py
echo.
echo Or use Docker:
echo   docker-compose up -d
"""

    # Create Unix script
    setup_path_unix = DEPLOY_DIR / "setup.sh"
    setup_path_unix.write_text(setup_script_unix, encoding='utf-8')

    # Make it executable on Unix systems
    if platform.system() != "Windows":
        try:
            setup_path_unix.chmod(0o755)
        except Exception:
            pass

    # Create Windows script
    setup_path_windows = DEPLOY_DIR / "setup.bat"
    setup_path_windows.write_text(setup_script_windows, encoding='utf-8')

    print(f"✓ Created {setup_path_unix}")
    print(f"✓ Created {setup_path_windows}")


def create_build_package():
    """Create a deployable package"""
    ensure_deploy_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    package_name = f"rooster_deploy_{timestamp}"
    package_dir = DEPLOY_DIR / package_name

    # Create package directory
    package_dir.mkdir(exist_ok=True)

    print(f"\n📦 Creating deployment package: {package_name}")

    # Copy required files
    for file in REQUIRED_FILES:
        if Path(file).exists():
            shutil.copy2(file, package_dir / file)
            print(f"  ✓ Copied {file}")
        else:
            print(f"  ⚠ Warning: {file} not found")

    # Copy required directories
    for dir_name in REQUIRED_DIRS:
        if Path(dir_name).exists():
            shutil.copytree(dir_name, package_dir / dir_name, dirs_exist_ok=True)
            print(f"  ✓ Copied {dir_name}/")

    # Create empty optional directories
    for dir_name in OPTIONAL_DIRS:
        (package_dir / dir_name).mkdir(exist_ok=True)
        print(f"  ✓ Created {dir_name}/")

    # Copy deployment files from .deploy directory
    for file in [
        "requirements.txt",
        "config.py",
        "run_production.py",
        "setup.sh",
        "setup.bat",
        "Dockerfile",
        "docker-compose.yml",
        ".dockerignore",
        "nginx.conf",
        "rooster.service",
    ]:
        deploy_file = DEPLOY_DIR / file
        if deploy_file.exists():
            shutil.copy2(deploy_file, package_dir / file)

    # Create README for deployment
    readme_content = f"""# Rooster Data Prepare Tool - Production Deployment

## Quick Start

### Method 1: Direct Python (Unix/Linux/macOS)
1. Run setup: `bash setup.sh`
2. Activate venv: `source venv/bin/activate`
3. Run server: `python run_production.py`

### Method 1: Direct Python (Windows)
1. Run setup: `setup.bat`
2. Activate venv: `venv\\Scripts\\activate.bat`
3. Run server: `python run_production.py`

### Method 2: Docker
1. Build and run: `docker-compose up -d`

### Method 3: Systemd Service (Linux only)
1. Edit `rooster.service` with correct paths
2. Copy to systemd: `sudo cp rooster.service /etc/systemd/system/`
3. Enable and start: `sudo systemctl enable --now rooster`

## Configuration
- Edit `config.py` for server settings
- Default port: {PORT}
- Access: http://localhost:{PORT}

## Nginx Reverse Proxy (Linux only)
- Copy `nginx.conf` to `/etc/nginx/sites-available/`
- Update server_name with your domain
- Enable site and reload nginx
"""

    readme_path = package_dir / "README_DEPLOY.md"
    readme_path.write_text(readme_content, encoding='utf-8')

    # Create ZIP archive in .deploy directory
    zip_path = DEPLOY_DIR / f"{package_name}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file_path in package_dir.rglob("*"):
            if file_path.is_file():
                arcname = file_path.relative_to(package_dir.parent)
                zipf.write(file_path, arcname)

    # Clean up directory (optional - keep it for inspection)
    # shutil.rmtree(package_dir)

    print(f"\n✅ Deployment package created: {zip_path}")
    print(f"📁 Package directory: {package_dir}/")
    return zip_path


def main():
    print("🚀 Rooster Deployment Builder\n")

    # Check if we're in the right directory
    if not Path("main.py").exists():
        print(
            "❌ Error: main.py not found. Run this script from the project root."
        )
        sys.exit(1)

    print("Creating deployment files...\n")

    # Create all necessary files
    create_requirements()
    create_production_config()
    create_run_script()
    create_setup_script()
    create_docker_files()
    create_systemd_service()
    create_nginx_config()

    print("\n" + "=" * 50)
    print(f"\n✅ All deployment files created in: {DEPLOY_DIR}/")

    # Ask if user wants to create a package
    response = input("\nCreate deployment package? (y/n): ").lower()
    if response == "y":
        package = create_build_package()
        print(f"\n🎉 Success! Deploy '{package}' to your server.")
    else:
        print("\n✅ Deployment files ready!")

    print("\n📚 Next steps:")
    print(f"  All files are in the '{DEPLOY_DIR}/' directory")
    print("  1. Copy package to your server")
    if platform.system() == "Windows":
        print("  2. Run: setup.bat (Windows)")
    else:
        print("  2. Run: bash setup.sh (Unix/Linux/macOS)")
    print("  3. Run: python run_production.py")
    print("\n  Or use Docker: docker-compose up -d")


if __name__ == "__main__":
    main()
