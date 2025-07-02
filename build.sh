#!/bin/bash

INCLUDES=(
	"static"
	"options"
	"icons"
	"service-worker.js"
	"manifest.json"
	"action.html"
)
OUTPUT="build.zip"

if [ -e $OUTPUT ]; then
	rm $OUTPUT
fi

zip -r $OUTPUT ${INCLUDES[@]}
