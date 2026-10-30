# ============================================================
# Sandbox Dockerfile: C++ Execution Environment
# Security: Non-root user (1001:1001), GNU C++ compiler
# ============================================================

FROM gcc:13-bookworm

# Create restricted non-root sandbox user
RUN groupadd -g 1001 sandboxgroup && \
    useradd -u 1001 -g sandboxgroup -m -d /home/sandboxuser -s /bin/bash sandboxuser

# Ephemeral working directory
WORKDIR /sandbox
RUN chown -R sandboxuser:sandboxgroup /sandbox /home/sandboxuser

# Switch to non-root user
USER 1001:1001

# Default command
CMD ["/sandbox/solution"]
