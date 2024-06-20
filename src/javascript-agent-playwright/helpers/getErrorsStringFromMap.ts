export const getErrorsStringFromMap = (errors: Map<string, number>) => {
  let errorsString = '';
  errors.forEach((value, key) => (errorsString += `${key} (x${value})`));
  return errorsString.replace(/[)](?=.*[)])/g, '), ');
};
