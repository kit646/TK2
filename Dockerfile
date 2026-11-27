FROM rust:1-slim AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=builder /app/target/release/a2_progress_test_portal /usr/local/bin/a2_progress_test_portal
COPY data/tests ./data/tests
COPY static ./static

ENV PORT=3000
EXPOSE 3000

CMD ["a2_progress_test_portal"]
