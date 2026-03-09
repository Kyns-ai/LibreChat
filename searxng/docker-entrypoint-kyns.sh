#!/bin/sh
set -e

# If SEARXNG_SECRET_KEY is set, inject it into settings.yml
if [ -n "${SEARXNG_SECRET_KEY}" ]; then
  sed -i "s/kyns_searxng_change_me_in_production/${SEARXNG_SECRET_KEY}/g" /etc/searxng/settings.yml
fi

# Delegate to the original SearXNG entrypoint
exec /sbin/tini -- /usr/local/searxng/dockerfiles/docker-entrypoint.sh "$@"
