# Slack integration for Worknice

An app to integrate Slack with Worknice.

## Prerequisites for development

- [Node (v20)](https://nodejs.org/en/download/)
- [pnpm](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/)

## Getting started

1.  Install dependencies:

    ```
    pnpm install --frozen-lockfile
    ```

2.  Start the background services (Redis instance):

    ```
    pnpm activate
    ```

3.  Start the Next.js app in dev mode:

    ```
    pnpm dev
    ```

    The app will be available at [http://localhost:6000](http://localhost:6000).

## Common tasks

- Tear down the background services:

  ```
  pnpm deactivate
  ```

- Connect to the local Redis instance using the `redis-cli`. On macOS, you can install it using
  Homebrew:

  ```
  brew install redis
  ```

  You can connect like this:

  ```
  redis-cli -p 6001 PING
  ```
