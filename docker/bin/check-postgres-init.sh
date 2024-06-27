#!/bin/bash

# Check if the init script has been completed
if [ -f /var/lib/postgresql/data/init-complete ]; then
  exit 0
else
  exit 1
fi
