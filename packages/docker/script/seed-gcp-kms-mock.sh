#!/bin/sh
# Seed a running KMS emulator with the key this prototype expects.
#
# Runs inside the emulator container as a compose `post_start` hook, so it can
# only use what that image has: BusyBox sh and wget. No curl, no Go toolchain.
#
# The emulator's storage is in-memory and starts empty, so this runs on every
# container start. Rather than parsing HTTP status codes — which BusyBox wget
# does not expose — it checks whether each resource exists first, which makes
# it idempotent without needing to distinguish 409 from a real failure.
set -eu

REST="${KMS_EMULATOR_REST:-http://localhost:8080}"
PROJECT="${GCP_KMS_PROJECT_ID:-console-dev-mock}"
LOCATION="${GCP_KMS_LOCATION:-global}"
KEYRING="${GCP_KMS_KEY_RING:-console-api}"
KEY="${GCP_KMS_KEY:-sdl-secrets}"
ALGORITHM="${KMS_ALGORITHM:-RSA_DECRYPT_OAEP_3072_SHA256}"

BASE="$REST/v1/projects/$PROJECT/locations/$LOCATION/keyRings"

# 0 if the resource is there, non-zero otherwise.
exists() {
  wget -q -O /dev/null "$1" 2>/dev/null
}

create() {
  url="$1"; body="$2"; label="$3"
  if wget -q -O /dev/null --header='Content-Type: application/json' --post-data="$body" "$url" 2>/dev/null; then
    echo "created $label"
  else
    echo "failed to create $label" >&2
    exit 1
  fi
}

attempt=0
until exists "$BASE"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "emulator not reachable at $REST after $attempt attempts" >&2
    exit 1
  fi
  sleep 0.5
done
echo "emulator reachable at $REST"

if exists "$BASE/$KEYRING"; then
  echo "key ring $KEYRING already exists"
else
  create "$BASE?keyRingId=$KEYRING" '{}' "key ring $KEYRING"
fi

if exists "$BASE/$KEYRING/cryptoKeys/$KEY"; then
  echo "crypto key $KEY already exists"
else
  create "$BASE/$KEYRING/cryptoKeys?cryptoKeyId=$KEY" \
    "{\"purpose\":\"ASYMMETRIC_DECRYPT\",\"versionTemplate\":{\"algorithm\":\"$ALGORITHM\",\"protectionLevel\":\"SOFTWARE\"}}" \
    "crypto key $KEY"
fi

wget -q -O - "$BASE/$KEYRING/cryptoKeys/$KEY/cryptoKeyVersions" |
  tr ',' '\n' | grep -E '"(state|algorithm)"' | sed 's/^/  /'
