# Use Apify image with Playwright browsers preinstalled
FROM apify/actor-node-playwright:20

COPY package*.json ./
RUN npm --quiet set progress=false \
    && npm install --omit=dev --no-optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true)

COPY . ./
CMD ["npm", "start"]
