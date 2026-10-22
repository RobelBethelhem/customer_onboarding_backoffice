# Customer Onboarding dashboard (Next.js 14, port 3500). Built as a standalone server; secrets and
# addresses (MONGODB_URI, JWT_SECRET, FAYDA_BACKEND_URL, SMS_*, WEB_APP_URL …) come from the
# environment when the container runs. The build downloads the Inter font from Google Fonts.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone \
    NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3500 \
    HOSTNAME=0.0.0.0 \
    TZ=Africa/Addis_Ababa
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3500
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3500)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
