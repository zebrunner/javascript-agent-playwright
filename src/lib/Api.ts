import Logger from './Logger';
import axios, {AxiosResponse} from 'axios';

export default class Api {
  private _maxAttempts: number;
  private _delayPerAttempt: number;

  constructor(maxAttempts: number, delayPerAttempt: number) {
    this._maxAttempts = maxAttempts;
    this._delayPerAttempt = delayPerAttempt;
  }

  async post(
    options: {
      url: string;
      payload: any;
      expectedStatusCode: number;
      config?: any;
    },
    attempt?: number
  ): Promise<AxiosResponse> {
    Logger.log(
      attempt
        ? `POST *attempt[${attempt}] ${this.shortenUrl(options.url)}`
        : `POST ${this.shortenUrl(options.url)}`
    );
    if (attempt >= 0) {
      await this.wait(this._delayPerAttempt);
    }

    try {
      let r = await axios.post(options.url, options.payload, options.config);
      if (r.status === options.expectedStatusCode || attempt === this._maxAttempts) {
        return r;
      } else {
        await this.post(
          {
            url: options.url,
            payload: options.payload,
            config: options.config,
            expectedStatusCode: options.expectedStatusCode,
          },
          isNaN(attempt) ? 0 : attempt + 1
        );
      }
    } catch (e) {
      if (attempt === this._maxAttempts) {
        console.log(`Payload: ${JSON.stringify(options.payload)} \n ${e.message} \n ${e.stack} \n ${e}`);
        return;
      } else {
        await this.post(
          {
            url: options.url,
            payload: options.payload,
            config: options.config,
            expectedStatusCode: options.expectedStatusCode,
          },
          isNaN(attempt) ? 0 : attempt + 1
        );
      }
    }
  }

  async put(
    options: {
      url: string;
      payload: any;
      expectedStatusCode: number;
      config?: any;
    },
    attempt?: number
  ): Promise<AxiosResponse> {
    Logger.log(
      attempt
        ? `PUT *attempt[${attempt}] ${this.shortenUrl(options.url)}`
        : `PUT ${this.shortenUrl(options.url)}`
    );
    if (attempt > 0) {
      await this.wait(this._delayPerAttempt);
    }

    try {
      let r = await axios.put(options.url, options.payload, options.config);
      if (r.status === options.expectedStatusCode || attempt === this._maxAttempts) {
        return r;
      } else {
        await this.put(
          {
            url: options.url,
            payload: options.payload,
            config: options.config,
            expectedStatusCode: options.expectedStatusCode,
          },
          isNaN(attempt) ? 0 : attempt + 1
        );
      }
    } catch (e) {
      if (attempt === this._maxAttempts) {
        console.log(`Payload: ${JSON.stringify(options.payload)} \n ${e.message} \n ${e.stack} \n ${e}`);
        return;
      } else {
        await this.put(
          {
            url: options.url,
            payload: options.payload,
            config: options.config,
            expectedStatusCode: options.expectedStatusCode,
          },
          isNaN(attempt) ? 0 : attempt + 1
        );
      }
    }
  }

  private shortenUrl(url: string): string {
    return url.replace(process.env.REPORTING_SERVER_HOSTNAME, '');
  }

  private wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
