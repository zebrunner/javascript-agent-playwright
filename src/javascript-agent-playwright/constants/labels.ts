export enum Labels {
  LOCALE = 'com.zebrunner.app/sut.locale',
}

export const isProviderSessionLabel = (key: string): boolean =>
  key === 'first-session-id' || key === 'sessionId';
