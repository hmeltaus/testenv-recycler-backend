export const sleep = async (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const randomInt = (min: number, max: number): number => {
  const minC = Math.ceil(min);
  const maxF = Math.floor(max);
  return Math.floor(Math.random() * (maxF - minC + 1) + minC);
};
