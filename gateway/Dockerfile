FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o /bin/gateway ./cmd/gateway

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /bin/gateway /bin/gateway
EXPOSE 8080
ENTRYPOINT ["/bin/gateway"]
