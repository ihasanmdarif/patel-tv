# ffmpeg-static/ffprobe-static-style packages download prebuilt glibc binaries at
# install time — a musl base (e.g. node:alpine) would silently produce binaries that
# can't execute. Stays on Debian for that reason.
FROM node:22-bookworm-slim

WORKDIR /app

RUN npm install -g pnpm@11

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY server.mjs ./

ENV NODE_ENV=production
ENV REMUX_CACHE_DIR=/app/data/remux
VOLUME ["/app/data/remux"]

EXPOSE 8790

CMD ["node", "server.mjs"]
