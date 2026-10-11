# syntax=docker/dockerfile:1

# ---- Stage 1: build the SPA ----
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Output goes to ../internal/webui/dist (see vite.config.ts), which the
# Go build embeds in stage 2.
RUN npm run build

# ---- Stage 2: build the Go binary with the SPA embedded ----
FROM golang:1.27-alpine AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /src/internal/webui/dist ./internal/webui/dist
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-s -w -X github.com/mrizkihidayat66/go-react-boilerplate/internal/httpapi.Version=${VERSION:-dev}" \
    -o /out/server ./cmd/server

# ---- Stage 3: minimal runtime ----
FROM scratch
COPY --from=server /out/server /server
# SQLite database and uploads live here; mount a volume on /data.
VOLUME /data
ENV APP_ENV=production \
    DB_PATH=/data/app.db \
    PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
