import { Elysia } from "elysia";

import config from "./config/config";
import { App } from "./server/api/app";
import { Hub } from "./server/events/hub";
import { createStore } from "./server/store/store";
import { Gateway } from "./server/transport/gateway";
import { MEMORY, POSTGRES } from "./server/types/store";

const hub = new Hub();
const storeKind = config.storeKind === "postgres" ? POSTGRES : MEMORY;
const store = createStore(storeKind, hub);

const app = new App(store);
const gateway = new Gateway(store, hub);

new Elysia().use(app.plugin).use(gateway.plugin).listen(config.port);
