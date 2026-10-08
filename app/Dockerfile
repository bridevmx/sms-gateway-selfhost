# Servicio de mensajes programados: PocketBase + frontend SvelteKit (SPA estática).

# --- Etapa 1: compilar el frontend ---
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Etapa 2: PocketBase ---
FROM alpine:3.20
ARG PB_VERSION=0.40.5
# La arquitectura se detecta con uname (TARGETARCH depende del builder y puede venir vacío).
RUN apk add --no-cache ca-certificates tzdata unzip wget \
 && case "$(uname -m)" in \
      x86_64) ARCH=amd64 ;; \
      aarch64) ARCH=arm64 ;; \
      armv7l|armv6l) ARCH=armv7 ;; \
      *) echo "Arquitectura no soportada: $(uname -m)" >&2; exit 1 ;; \
    esac \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip" -O /tmp/pb.zip \
 && unzip -q /tmp/pb.zip -d /pb && rm /tmp/pb.zip && chmod +x /pb/pocketbase \
 && /pb/pocketbase --version

WORKDIR /pb
COPY pb_migrations ./pb_migrations
COPY pb_hooks ./pb_hooks
COPY --from=web /web/build ./pb_public
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8090
VOLUME /pb/pb_data
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8090/api/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
