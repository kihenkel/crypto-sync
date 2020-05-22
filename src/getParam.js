module.exports = (flags, argumentList, shouldCheckExistence) => {
  if (!flags.some(flag => argumentList.includes(flag))) {
    return shouldCheckExistence ? false : '';
  } else if (shouldCheckExistence) {
    return true;
  }

  const flagIndex = argumentList.findIndex((arg) => flags.includes(arg));
  return argumentList[flagIndex + 1];
};
