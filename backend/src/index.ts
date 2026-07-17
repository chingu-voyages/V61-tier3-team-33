import config from "./config/config";
import { authPlugin } from "./server/http/bootstrap";
import { Gateway } from "./server/transport/gateway";

const gateway = new Gateway();

gateway.app.use(authPlugin);

gateway.start(config.port);