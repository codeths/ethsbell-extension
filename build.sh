#!/bin/bash
rm out.zip
zip out.zip $(find . ! \( -path "./node_modules/*" -o -path "./.git/*" -o -name "*.zip" \))