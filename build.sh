#!/bin/bash
rm out.zip || true
zip out.zip $(find -type f -not -name *.zip -not -path *.git*)