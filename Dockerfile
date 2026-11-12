FROM mcr.microsoft.com/playwright:v1.65.0-jammy

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NO_SANDBOX=1
ENV PORT=8787

RUN apt-get update && apt-get install -y --no-install-recommends xvfb xauth \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY bunq-worker/package.json ./
RUN npm install --omit=dev
COPY bunq-worker/server.mjs ./

EXPOSE 8787

CMD ["sh","-c","echo '--- scherm starten ---'; Xvfb :99 -screen 0 1366x900x24 & export DISPLAY=:99; sleep 1; echo '--- scherm klaar, worker starten ---'; exec node server.mjs"]