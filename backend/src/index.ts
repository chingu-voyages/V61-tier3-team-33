import { Gateway } from "./server/transport/gateway";

const gateway = new Gateway();

const PORT = Number(process.env.PORT ?? 3001);

gateway.start(PORT);
