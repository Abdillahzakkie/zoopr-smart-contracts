FROM node:16.4 AS build
WORKDIR /src
COPY package.json .
RUN yarn install
COPY . .

FROM node:16.14-alpine
WORKDIR /src
COPY --from=build /src .
ENTRYPOINT ["yarn", "run"]