#!/bin/bash
rm out.xpi || true
zip out.xpi $(find -type f -not -name *.zip -not -path *.git*)
