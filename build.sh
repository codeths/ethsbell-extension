#!/bin/bash
zip out.zip $(find . ! \( -path "./node_modules*" -o -path "./.*" -o -name "*.zip" -o -name "*.sh" -o -name "package.json" -o -name "package-lock.json" \))