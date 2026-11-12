# Playwright met een échte (headed) Chrome onder Xvfb.
# Headless werkt níet: reCAPTCHA geeft dan een te lage score en bunq weigert.
FROM mcr.microsoft.com/playwright:v1.65.0-jammy

# Browsers zitten al in deze image; niet nog eens downloaden.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# In een container draait Chrome als root -> sandbox moet uit.
ENV NO_SANDBOX=1

# xvfb zit al in de Playwright-image; DISPLAY wordt door xvfb-run gezet.
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./

ENV PORT=8787
EXPOSE 8787

# --auto-servernum / -a: pakt een vrije display
CMD ["xvfb-run", "-a", "--server-args=-screen 0 1366x900x24", "node", "server.mjs"]
