#!/bin/bash
rm out.xpi out.crx || true
zip out.xpi $(find -type f -not -name *.zip -not -path *.git* -not -name *.sh)
cp out.xpi out.crx