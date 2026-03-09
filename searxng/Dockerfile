# SearXNG Dockerfile for Railway deployment
# Bakes our custom settings into the official image.
# Deploy this via: railway up --service searxng --context ./searxng
FROM searxng/searxng:latest

USER root

# Copy our custom config files
COPY settings.yml /etc/searxng/settings.yml
COPY limiter.toml /etc/searxng/limiter.toml

# Fix permissions — SearXNG runs as uid 977 (searxng user)
RUN chown 977:977 /etc/searxng/settings.yml /etc/searxng/limiter.toml && \
    chmod 644 /etc/searxng/settings.yml /etc/searxng/limiter.toml

# Use a startup wrapper that injects SEARXNG_SECRET_KEY env var into settings
COPY docker-entrypoint-kyns.sh /usr/local/bin/docker-entrypoint-kyns.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-kyns.sh

USER searxng

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-kyns.sh"]
