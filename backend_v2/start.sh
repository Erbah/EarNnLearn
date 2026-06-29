#!/bin/sh
python apply_schema_updates.py
exec uvicorn main:app --host 0.0.0.0 --port $PORT
