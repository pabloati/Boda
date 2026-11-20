# The site editor in a box: a clone of the repo, the dev server in shared mode and a Cloudflare
# quick tunnel. Nothing from the host is mounted; the only secrets are the editor password and a
# GitHub deploy key scoped to this one repo, both passed in at run time. See _dev/compartir.md.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    && chmod +x /usr/local/bin/cloudflared \
    && useradd -m -u 1500 boda

# Claude Code, for the editor's chat (_dev/editor_chat.py). One self-contained program, copied out of the
# installer's home folder so the volume on /home/boda cannot shadow it. It only works when run.sh passes
# a token (CLAUDE_CODE_OAUTH_TOKEN); without one the entrypoint turns the chat off (BODA_CLAUDE=off).
RUN curl -fsSL https://claude.ai/install.sh | bash \
    && cp -L /root/.local/bin/claude /usr/local/bin/claude && chmod 755 /usr/local/bin/claude \
    && rm -rf /root/.local /root/.claude /root/.claude.json /root/.cache
ENV DISABLE_AUTOUPDATER=1

USER boda
WORKDIR /home/boda
COPY --chown=boda:boda entrypoint.sh /usr/local/bin/boda-entrypoint.sh
RUN chmod +x /usr/local/bin/boda-entrypoint.sh

ENV BODA_REPO=git@github.com:pabloati/Boda.git BODA_BRANCH=editor BODA_PORT=8090
EXPOSE 8090
ENTRYPOINT ["/bin/bash", "/usr/local/bin/boda-entrypoint.sh"]
