# Foot canonical repository — devcontainer image.
#
# The PostgreSQL 17 CLIENT bootstrap runs HERE, at image-build time, because
# GitHub Codespaces must build this image before it can start the container.
# A fresh Codespace observed on 2026-08-30 started without executing
# onCreateCommand/postCreateCommand at all, so lifecycle hooks are treated as
# redundancy only — never as the sole installation mechanism. The installer
# ends by running the fail-closed verifier, so the image build fails loudly
# (never a silently degraded workspace) if PostgreSQL 17+ client tools are
# not selected.
#
# CLIENT ONLY: installs pg_dump/psql (postgresql-client-17); never installs
# or starts a PostgreSQL database server.
# NON-SECRET: no connection string, credential, hostname, database name,
# project reference, or backup path appears here.
#
# No USER or HOME override: the base image's own default user metadata is
# inherited unchanged, and every bootstrap script is user-agnostic
# (see docs/codespaces-recovery-workspace.md).
FROM mcr.microsoft.com/devcontainers/universal:2

COPY install-postgres-client.sh verify-postgres-client.sh /tmp/foot-devcontainer-bootstrap/
RUN bash /tmp/foot-devcontainer-bootstrap/install-postgres-client.sh \
 && rm -rf /tmp/foot-devcontainer-bootstrap
