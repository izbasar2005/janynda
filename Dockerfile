# --- 1) Frontend build stage ---
FROM node:20-alpine AS frontend
WORKDIR /frontend

# package файлын бөлек көшіріп, npm install кешін кэштеу
COPY frontend/package*.json ./
RUN npm ci

# frontend кодын көшіріп, build жасау
COPY frontend/ ./
RUN npm run build


# --- 2) Backend build stage ---
FROM golang:1.24-alpine AS backend
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o janymda ./cmd/api


# --- 3) Runtime stage (жеңіл образ) ---
FROM alpine:3.20
WORKDIR /app

# backend бинарник
COPY --from=backend /app/janymda ./janymda

# backend-тің static папкасы керек болса (uploads үшін), папканы дайындап қоямыз
RUN mkdir -p ./static/uploads

# frontend dist → static (сенің xcopy істегенің осы)
COPY --from=frontend /frontend/dist/ ./static/

EXPOSE 8080
CMD ["./janymda"]