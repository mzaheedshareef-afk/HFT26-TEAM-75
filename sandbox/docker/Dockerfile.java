# ============================================================
# Sandbox Dockerfile: Java Execution Environment
# Security: Non-root user (1001:1001), OpenJDK 17 headless
# ============================================================

FROM openjdk:17-slim

# Create restricted non-root sandbox user
RUN groupadd -g 1001 sandboxgroup && \
    useradd -u 1001 -g sandboxgroup -m -d /home/sandboxuser -s /bin/bash sandboxuser

# Ephemeral working directory
WORKDIR /sandbox
RUN chown -R sandboxuser:sandboxgroup /sandbox /home/sandboxuser

# Switch to non-root user
USER 1001:1001

# Default command
CMD ["java", "-Xmx256m", "-Xss16m", "-cp", "/sandbox", "Solution"]
