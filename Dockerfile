# --- 1) Frontend build stage ---
FROM node:20-alpine AS frontend
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

ARG VITE_TURNSTILE_SITE_KEY=0x4AAAAAADj_iE0yMQFExt6Y
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

COPY frontend/ ./
RUN npm run build


# --- 2) Backend build stage ---
FROM golang:1.24-alpine AS backend
WORKDIR /app

RUN apk add --no-cache git bash tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o janymda ./cmd/api


# --- 3) Runtime stage ---
FROM alpine:3.20
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=backend /app/janymda ./janymda
RUN mkdir -p ./static/uploads
COPY --from=frontend /frontend/dist/ ./static/

EXPOSE 8080
CMD ["./janymda"]
