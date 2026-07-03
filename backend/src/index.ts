import config from "./config/config";
import { Gateway } from "./server/transport/gateway";

const gateway = new Gateway();

gateway.start(config.port);
