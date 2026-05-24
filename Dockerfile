# Use official slim Python image
FROM python:3.13-slim

# Set environment variables for optimized execution
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Set working directory
WORKDIR /app

# Install system dependencies required for compiling Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies
COPY backend/requirements.txt .

# Install Python requirements
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source files
COPY backend/ ./backend/

# Create folders for runtime data storage
RUN mkdir -p /app/backend/data/uploads /app/backend/data/chromadb

# Expose server port
EXPOSE 8000

# Start server using Uvicorn
CMD ["sh", "-c", "python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT"]
