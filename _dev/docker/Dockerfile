# The site editor in a box: a clone of the repo, the dev server in shared mode and a Cloudflare
# quick tunnel. Nothing from the host is mounted; the only secrets are the editor password and a
# GitHub deploy key scoped to this one repo, both passed in at run time. See _dev/compartir.md.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    && chmod +x /usr/local/bin/cloudflared \
    && useradd -m -u 1500 boda

USER boda
WORKDIR /home/boda
COPY --chown=boda:boda entrypoint.sh /home/boda/entrypoint.sh
RUN chmod +x /home/boda/entrypoint.sh

ENV BODA_REPO=git@github.com:pabloati/Boda.git BODA_BRANCH=editor BODA_PORT=8090
EXPOSE 8090
ENTRYPOINT ["/bin/bash", "/home/boda/entrypoint.sh"]
