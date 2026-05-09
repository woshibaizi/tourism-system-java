let toastHandler = null;

export const setToastHandler = (handler) => {
  toastHandler = handler;
};

export const showToast = (type, message) => {
  if (toastHandler) {
    toastHandler(type, message);
  } else {
    console.log(`[Toast:${type}]`, message);
  }
};
