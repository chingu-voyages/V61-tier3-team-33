import config from "./config/config";
import { authPlugin } from "./server/http/bootstrap";
import { Gateway } from "./server/transport/gateway";
import { friendPlugin } from "./server/http/bootstrap";
const gateway = new Gateway();

gateway.app
.use(authPlugin)
.use(friendPlugin);;

gateway.start(config.port);