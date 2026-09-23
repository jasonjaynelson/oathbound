#!/usr/bin/env bash
exec "$(dirname "$(readlink -f "$0")")/scripts/launch-oathbound.sh"
