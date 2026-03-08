import "./config/load-env.js";

import { createServer } from "node:http";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initSocketIO } from "./lib/socket.js";

const app = createApp();
const server = createServer(app);

initSocketIO(server);

server.listen(env.PORT, () => {
  console.log(`PRISM server listening on port ${env.PORT}`);
});
