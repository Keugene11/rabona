#!/usr/bin/env bash
# Run this AFTER you've uploaded .signing/ios_dist.csr to developer.apple.com
# (Certificates → "+" → Apple Distribution) and saved the resulting
# distribution.cer into the .signing/ folder.
#
# It builds the .p12 and pushes IOS_DIST_CERT_P12_BASE64 to GitHub Secrets.

set -euo pipefail
cd "$(dirname "$0")/.."

CERT_PATH=".signing/distribution.cer"
PEM_PATH=".signing/distribution.pem"
P12_PATH=".signing/ios_dist.p12"
KEY_PATH=".signing/ios_dist.key"
PASS_PATH=".signing/p12_password.txt"

if [[ ! -f "$CERT_PATH" ]]; then
  echo "ERROR: $CERT_PATH not found." >&2
  echo "Upload .signing/ios_dist.csr at developer.apple.com → Certificates → +" >&2
  echo "→ Apple Distribution, download the .cer, save it as $CERT_PATH, re-run." >&2
  exit 1
fi
[[ -f "$KEY_PATH" ]]  || { echo "ERROR: $KEY_PATH missing." >&2; exit 1; }
[[ -f "$PASS_PATH" ]] || { echo "ERROR: $PASS_PATH missing." >&2; exit 1; }

P12_PASSWORD=$(cat "$PASS_PATH")

echo "Converting DER cert to PEM..."
openssl x509 -in "$CERT_PATH" -inform DER -out "$PEM_PATH" -outform PEM

echo "Packaging .p12..."
# -legacy keeps the .p12 in 3DES/SHA1 format that the macOS keychain on the
# CI runner imports cleanly. OpenSSL 3 defaults to AES which sometimes trips
# `security import` on the runner.
openssl pkcs12 -export \
  -inkey "$KEY_PATH" \
  -in "$PEM_PATH" \
  -out "$P12_PATH" \
  -name "Apple Distribution: Rabona" \
  -password "pass:$P12_PASSWORD" \
  -legacy

echo "Uploading IOS_DIST_CERT_P12_BASE64 to GitHub Secrets..."
base64 -w0 "$P12_PATH" | gh secret set IOS_DIST_CERT_P12_BASE64

echo
echo "Done. All 6 iOS Release secrets are now set."
echo "Trigger the build:"
echo "  gh workflow run \"iOS Release\""
echo "Or visit Actions → iOS Release → Run workflow."
