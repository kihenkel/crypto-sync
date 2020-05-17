module.exports = (flags, argumentList) => {
  if (!flags.some(flag => argumentList.includes(flag))) {
    return '';
  }

  const flagIndex = argumentList.findIndex((arg) => flags.includes(arg));
  return argumentList[flagIndex + 1];
};
