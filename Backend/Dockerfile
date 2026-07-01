FROM python:3.11-slim

WORKDIR /app

# System deps: compiler, libpq for psycopg2, curl for healthchecks, libgomp for ML libs
RUN apt-get update && apt-get install -y --no-install-recommends --fix-missing \
    gcc g++ libpq-dev curl libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first so sentence-transformers doesn't pull the 2 GB GPU build
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining deps (cached layer unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model directly (avoids broken URL from `spacy download`)
RUN pip install --no-cache-dir https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

# Copy app source
COPY . .

EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
