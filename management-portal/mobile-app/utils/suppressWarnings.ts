// Suppress specific React Native Web deprecation warnings during development
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('pointerEvents is deprecated')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

export {};
