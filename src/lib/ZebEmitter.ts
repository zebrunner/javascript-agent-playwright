import { tcmEvents } from "./constants";
import { sendEventToReporter } from "./utils";

export const ZebEmitter = {
  addTcmRunOptions: (options): void => {
    sendEventToReporter(tcmEvents.TCM_RUN_OPTIONS, options);
  },
  addTcmTestOptions: (options): void => {
    sendEventToReporter(tcmEvents.TCM_TEST_OPTIONS, options);
  },
  setMaintainer: (maintainer):void => {
    sendEventToReporter(tcmEvents.SET_MAINTAINER, maintainer)
  },
}
