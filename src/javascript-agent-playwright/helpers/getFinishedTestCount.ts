export const getFinishedTestCount = (pwTestIdToZbrFinishedTry: Map<string, number>) => {
  return Array.from(pwTestIdToZbrFinishedTry.values()).reduce((acc, value) => acc + value + 1, 0);
};
