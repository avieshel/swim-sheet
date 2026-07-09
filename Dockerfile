# ---- Base node ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm ci

# ---- Build client ----
COPY client/ client/
RUN npm run build --prefix client

# ---- Build server ----
COPY server/ server/
RUN npm run build --prefix server

# ---- Copy client build into server public ----
RUN cp -r client/dist server/public

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/server/dist ./server/dist
COPY --from=base /app/server/public ./server/public
COPY --from=base /app/server/package*.json ./server/
# Only production deps needed; we already have node_modules from base? Actually we need to copy node_modules from base as well.
# Let's copy node_modules from base for server.
COPY --from=base /app/server/node_modules ./server/node_modules

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "server/dist/index.js"]