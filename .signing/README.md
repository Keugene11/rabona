# Signing materials

Everything else in this directory is gitignored — it contains private keys.

Files:
- `ios_dist.key` — Apple Distribution private key (RSA 2048)
- `ios_dist.csr` — Certificate Signing Request you upload to developer.apple.com
- `p12_password.txt` — random password used when packaging the .p12

Workflow:
1. Generated automatically by Claude.
2. Upload `ios_dist.csr` at developer.apple.com → Certificates → "+" → Apple Distribution.
3. Download the resulting `distribution.cer` into this folder.
4. Run `scripts/finalize-ios-signing.sh` (or have Claude finish it).
