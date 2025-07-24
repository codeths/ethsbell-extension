#!/bin/bash

INCLUDES=(
	"src"
	"manifest.json"
	"LICENSE"
)
OUTPUT="build.zip"

if [ -e $OUTPUT ]; then
	rm $OUTPUT
fi

zip -r $OUTPUT ${INCLUDES[@]}
