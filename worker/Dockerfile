FROM node:20-slim

# System deps: ffmpeg (assembly) + python3/pip (faster-whisper transcription).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ffmpeg \
     python3 \
     python3-pip \
     ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Transcription model runner. Pin a known-good version.
RUN pip3 install --no-cache-dir --break-system-packages faster-whisper==1.0.3

WORKDIR /app

# Install worker deps first for better layer caching.
COPY package.json ./
RUN npm install --omit=dev

# Copy worker source.
COPY worker.mjs pipeline.mjs ./

# The Higgsfield CLI is installed at deploy time per its docs, e.g.:
#   RUN npm install -g @higgsfield/cli
# (left out here so the base image builds without external creds).

ENV NODE_ENV=production
CMD ["node", "worker.mjs"]
