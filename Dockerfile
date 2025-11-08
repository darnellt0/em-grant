FROM python:3.11-slim

# Install Chrome and ChromeDriver dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg2 \
    unzip \
    curl \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories for output
RUN mkdir -p screenshots html_snapshots backups logs

# Health check
HEALTHCHECK --interval=1h --timeout=30s --start-period=10s \
    CMD test -f grant_system.log && test $(find grant_system.log -mmin -1500 | wc -l) -eq 1 || exit 1

# Run scraper
CMD ["python", "grantsgov_scraper_prod.py"]
