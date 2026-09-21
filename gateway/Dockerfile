FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /bin/gateway ./cmd/gateway && go build -o /bin/social-worker ./cmd/worker && go build -o /bin/social-scanner ./cmd/scanner

FROM alpine:3.20
RUN apk add --no-cache ca-certificates chromium
COPY --from=build /bin/gateway /bin/gateway
COPY --from=build /bin/social-worker /bin/social-worker
COPY --from=build /bin/social-scanner /bin/social-scanner
EXPOSE 8080
ENTRYPOINT ["/bin/gateway"]
