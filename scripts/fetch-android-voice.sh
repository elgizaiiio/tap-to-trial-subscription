#!/usr/bin/env bash
# Downloads the two large on-phone voice files that are kept out of the repository (over the 10 MB file limit).
# Run before building the Android app. Sources: official sherpa-onnx releases (Apache-2.0) and Piper ar_JO-kareem voice.
set -euo pipefail
cd "$(dirname "$0")/../android"
B=https://github.com/k2-fsa/sherpa-onnx/releases/download
mkdir -p app/libs app/src/main/assets/ceyo-voice/tts
[ -f app/libs/sherpa-onnx-2.0.1.aar ] || curl -fsSL -o app/libs/sherpa-onnx-2.0.1.aar "$B/v2.0.1/sherpa-onnx-static-link-onnxruntime-2.0.1.aar"
if [ ! -f app/src/main/assets/ceyo-voice/tts/model.onnx ]; then
  tmp=$(mktemp -d); curl -fsSL -o "$tmp/v.tbz" "$B/tts-models/vits-piper-ar_JO-kareem-medium-int8.tar.bz2"
  python3 -c "import tarfile,sys;tarfile.open(sys.argv[1],'r:bz2').extract('vits-piper-ar_JO-kareem-medium-int8/ar_JO-kareem-medium.onnx',sys.argv[2])" "$tmp/v.tbz" "$tmp"
  mv "$tmp/vits-piper-ar_JO-kareem-medium-int8/ar_JO-kareem-medium.onnx" app/src/main/assets/ceyo-voice/tts/model.onnx; rm -rf "$tmp"
fi
echo "voice files ready"
