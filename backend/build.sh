#!/usr/bin/env bash
set -e
pip install -r requirements.txt
pip install stripe==7.8.0 --force-reinstall --no-cache-dir