# Python SLA Analytics Service
# Dockerfile for Cloud Run deployment

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostgreSQL
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn flask flask-cors

# Copy application code
COPY *.py ./

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8080/health')" || exit 1

# Run with gunicorn for production
CMD exec gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 300 --access-logfile - --error-logfile - api_server:app
