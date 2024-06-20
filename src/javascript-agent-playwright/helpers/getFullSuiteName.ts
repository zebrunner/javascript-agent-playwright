import { ExtendedPwTestCase } from '../types';

export const getFullSuiteName = (pwTest: ExtendedPwTestCase) => {
  const suiteTitle = pwTest.parent.title;
  const suiteParentTitle = pwTest.parent.parent.title;

  return suiteParentTitle ? `${suiteParentTitle} > ${suiteTitle}` : suiteTitle;
};
