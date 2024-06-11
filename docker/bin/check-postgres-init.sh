#!/bin/bash

# Check if the init script has completed
if [ -f /var/lib/postgresql/data/init-complete ]; then
  exit 0
else
  exit 1
fi