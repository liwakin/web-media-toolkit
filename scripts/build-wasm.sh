#!/bin/bash

set -euo pipefail

echo "Building ffmpeg_wasm"

docker build -t ffmpeg_wasm .

echo "Copying files"

scripts/copy-files.sh

