#!/bin/bash
# Helper script to create files reliably
# Usage: ./create-file.sh <filepath> <content>

set -e  # Exit on error

FILEPATH="$1"
CONTENT="$2"

if [ -z "$FILEPATH" ]; then
  echo "Error: filepath required"
  exit 1
fi

if [ -z "$CONTENT" ]; then
  echo "Error: content required"
  exit 1
fi

# Create directory if doesn't exist
DIRPATH=$(dirname "$FILEPATH")
mkdir -p "$DIRPATH"

# Write content to file
echo "$CONTENT" > "$FILEPATH"

# Verify file was created
if [ -f "$FILEPATH" ]; then
  echo "✅ File created: $FILEPATH"
  echo "📏 Size: $(wc -c < "$FILEPATH") bytes"
  echo "📄 Lines: $(wc -l < "$FILEPATH") lines"
else
  echo "❌ Failed to create file"
  exit 1
fi
