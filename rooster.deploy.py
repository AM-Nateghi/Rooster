#!/usr/bin/env python3
"""
Production Deployment Script for Rooster Data Prepare Tool
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path
import zipfile
from datetime import datetime

# Project structure
REQUIRED_FILES = ["rooster.main.py", "index.html", "graph.html", "requirements.txt"]

REQUIRED_DIRS = [
    "assets",
]

OPTIONAL_DIRS = ["json_data", "backups"]

PORT = 8014


def create_requirements():
    """Create requirements.txt if it doesn't exist"""
    requirements = """fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
"""

    with open("requirements.txt", "w") as f:
        f.write(requirements)
    print("✓ Created requirements.txt")


def create_production_config():
    f"""Create production configuration file"""
    config = """# Production Configuration
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

    with open("config.py", "w") as f:
        f.write(config)
    print("✓ Created production config")


def create_run_script():
    """Create production run script"""
    run_script = f"""#!/usr/bin/env python3
\"\"\"
Production Runner for Rooster Data Prepare Tool
\"\"\"

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
"""

    with open("run_production.py", "w") as f:
        f.write(run_script)

    # Make it executable on Unix systems
    try:
        os.chmod("run_production.py", 0o755)
    except:
        pass

    print("✓ Created run_production.py")


def create_systemd_service():
    """Create systemd service file for Linux servers"""
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

    with open("rooster.service", "w") as f:
        f.write(service_content)

    print("✓ Created systemd service file (rooster.service)")
    print("  Note: Update paths in the service file before using!")


def create_docker_files():
    """Create Docker files for containerized deployment"""

    dockerfile = f"""FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY rooster.main.py .
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

    with open("Dockerfile", "w") as f:
        f.write(dockerfile)

    with open(".dockerignore", "w") as f:
        f.write(dockerignore)

    with open("docker-compose.yml", "w") as f:
        f.write(docker_compose)

    print("✓ Created Docker files (Dockerfile, docker-compose.yml, .dockerignore)")


def create_nginx_config():
    """Create nginx configuration for reverse proxy"""
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
    with open("nginx.conf", "w") as f:
        f.write(nginx_config)

    print("✓ Created nginx configuration (nginx.conf)")


def create_setup_script():
    """Create setup script for easy deployment"""
    setup_script = """#!/bin/bash
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

    with open("setup.sh", "w") as f:
        f.write(setup_script)

    # Make it executable
    try:
        os.chmod("setup.sh", 0o755)
    except:
        pass

    print("✓ Created setup script (setup.sh)")


def create_build_package():
    """Create a deployable package"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    package_name = f"rooster_deploy_{timestamp}"
    package_dir = Path(package_name)

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

    # Copy deployment files
    for file in [
        "requirements.txt",
        "config.py",
        "run_production.py",
        "setup.sh",
        "Dockerfile",
        "docker-compose.yml",
        ".dockerignore",
        "nginx.conf",
        "rooster.service",
    ]:
        if Path(file).exists():
            shutil.copy2(file, package_dir / file)

    # Create README for deployment
    readme_content = f"""# Rooster Data Prepare Tool - Production Deployment

## Quick Start

### Method 1: Direct Python
1. Run setup: `bash setup.sh`
2. Activate venv: `source venv/bin/activate`
3. Run server: `python run_production.py`

### Method 2: Docker
1. Build and run: `docker-compose up -d`

### Method 3: Systemd Service (Linux)
1. Edit `rooster.service` with correct paths
2. Copy to systemd: `sudo cp rooster.service /etc/systemd/system/`
3. Enable and start: `sudo systemctl enable --now rooster`

## Configuration
- Edit `config.py` for server settings
- Default port: {PORT}
- Access: http://localhost:{PORT}

## Nginx Reverse Proxy
- Copy `nginx.conf` to `/etc/nginx/sites-available/`
- Update server_name with your domain
- Enable site and reload nginx
"""

    with open(package_dir / "README_DEPLOY.md", "w") as f:
        f.write(readme_content)

    # Create ZIP archive
    zip_name = f"{package_name}.zip"
    with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file_path in package_dir.rglob("*"):
            if file_path.is_file():
                arcname = file_path.relative_to(package_dir.parent)
                zipf.write(file_path, arcname)

    # Clean up directory (optional - keep it for inspection)
    # shutil.rmtree(package_dir)

    print(f"\n✅ Deployment package created: {zip_name}")
    print(f"📁 Package directory: {package_name}/")
    return zip_name


def main():
    print("🚀 Rooster Deployment Builder\n")

    # Check if we're in the right directory
    if not Path("rooster.main.py").exists():
        print(
            "❌ Error: rooster.main.py not found. Run this script from the project root."
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

    # Ask if user wants to create a package
    response = input("\nCreate deployment package? (y/n): ").lower()
    if response == "y":
        package = create_build_package()
        print(f"\n🎉 Success! Deploy '{package}' to your server.")
    else:
        print("\n✅ Deployment files created successfully!")

    print("\n📚 Next steps:")
    print("  1. Copy files to your server")
    print("  2. Run: bash setup.sh")
    print("  3. Run: python run_production.py")
    print("\n  Or use Docker: docker-compose up -d")


if __name__ == "__main__":
    main()
