FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@11.22.0

# Whole-repo build context (Railway root directory = /) so the pnpm
# workspace + lockfile + shared sim package are all available.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/sim ./packages/sim
COPY services/game ./services/game

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dark-fantasy/sim build
RUN pnpm --filter @dark-fantasy/game build

EXPOSE 2567
ENV PORT=2567

CMD ["node", "services/game/dist/index.js"]