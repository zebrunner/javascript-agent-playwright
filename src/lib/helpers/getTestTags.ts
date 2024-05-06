export const getTestTags = (testTitle, tcmTestOptions) => {
  const tags = testTitle.match(/@\w*/g) || [];

  if (tcmTestOptions) {
    tcmTestOptions.forEach((el) => {
      tags.push(el);
    });
  }

  if (tags.length !== 0) {
    return tags.map((c) => {
      if (typeof c === 'string') {
        return { key: 'tag', value: c.replace('@', '') };
      }
      if (typeof c === 'object') {
        return c;
      }
    });
  }

  return null;
};
