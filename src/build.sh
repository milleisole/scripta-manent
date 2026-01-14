#!/bin/bash
#
# Scripta Manent - Build Script
# Creates a distributable release from src/ to dist/
#

VERSION=$1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if version is provided
if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Version number required${NC}"
    echo ""
    echo "Usage: ./build.sh <version>"
    echo ""
    echo "Examples:"
    echo "  ./build.sh v1.0"
    echo "  ./build.sh v1.1"
    echo "  ./build.sh v2.0-beta"
    exit 1
fi

# Check if src directory exists
if [ ! -d "src" ]; then
    echo -e "${RED}Error: src/ directory not found${NC}"
    echo "Make sure you're running this script from the project root."
    exit 1
fi

# Check if version already exists
if [ -d "dist/$VERSION" ]; then
    echo -e "${YELLOW}Warning: dist/$VERSION already exists${NC}"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    rm -rf "dist/$VERSION"
fi

# Create dist directory if it doesn't exist
mkdir -p dist

# Copy src to dist/version
echo "Building Scripta Manent $VERSION..."
echo ""

cp -r src "dist/$VERSION"

# Update version in manifest.json if exists
if [ -f "dist/$VERSION/manifest.json" ]; then
    # Use sed to update version (works on both macOS and Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" "dist/$VERSION/manifest.json"
    else
        sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" "dist/$VERSION/manifest.json"
    fi
fi

# Count files
FILE_COUNT=$(find "dist/$VERSION" -type f | wc -l | tr -d ' ')

echo -e "${GREEN}✓ Build complete!${NC}"
echo ""
echo "  Version:  $VERSION"
echo "  Location: dist/$VERSION/"
echo "  Files:    $FILE_COUNT"
echo ""
echo "To test locally:"
echo "  python -m http.server 8080 -d dist/$VERSION"
echo ""
echo "Then open: http://localhost:8080"
echo ""
echo "GitHub Pages URL (after push):"
echo "  https://milleisole.github.io/scripta-manent/dist/$VERSION/index.html"
