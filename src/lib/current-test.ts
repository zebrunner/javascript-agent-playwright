import log from "loglevel";
import { EventNames } from "./constant/custom-events";
import { isNotBlankString } from "./type-utils";

const logger = log.getLogger('zebrunner');

export const CurrentTest = {

  setMaintainer: (maintainer: string): void => {
    if (isNotBlankString(maintainer)) {
      const eventType = EventNames.SET_MAINTAINER
      const payload = JSON.stringify({ eventType, payload: maintainer })

      process.stdout.write(payload);
    } else {
      logger.warn(`Maintainer must be a not blank string. Provided value is '${maintainer}'`);
    }
  },

};
