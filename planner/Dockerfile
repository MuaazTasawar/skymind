FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir \
    grpcio \
    grpcio-tools \
    protobuf \
    numpy \
    shapely \
    ultralytics \
    opencv-python-headless \
    Pillow \
    python-dotenv

# Copy source
COPY . .

# Generate proto stubs at build time
RUN python -m grpc_tools.protoc \
    -I ./proto \
    --python_out=./proto \
    --grpc_python_out=./proto \
    ./proto/planner.proto 2>/dev/null || true

ENV PLANNER_GRPC_PORT=50051

EXPOSE 50051

CMD ["python", "main.py"]