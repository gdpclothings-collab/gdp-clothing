const disconnectedError = () => {
  const error = new Error("Standalone GDP Clothing copy: no backend is connected.");
  error.code = "BACKEND_NOT_CONNECTED";
  return error;
};

const entity = new Proxy({}, {
  get: () => ({
    list: async () => [],
    filter: async () => [],
    get: async () => null,
    create: async () => { throw disconnectedError(); },
    update: async () => { throw disconnectedError(); },
    delete: async () => { throw disconnectedError(); },
  }),
});

export const base44 = {
  entities: new Proxy({}, { get: () => entity }),
  auth: {
    isAuthenticated: async () => false,
    me: async () => { throw disconnectedError(); },
    loginViaEmailPassword: async () => { throw disconnectedError(); },
    loginWithProvider: () => { throw disconnectedError(); },
    register: async () => { throw disconnectedError(); },
    resendOtp: async () => { throw disconnectedError(); },
    verifyOtp: async () => { throw disconnectedError(); },
    resetPassword: async () => { throw disconnectedError(); },
    resetPasswordRequest: async () => { throw disconnectedError(); },
    setToken: () => {},
    logout: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("base44_access_token");
        localStorage.removeItem("token");
      }
    },
    redirectToLogin: () => {
      if (typeof window !== "undefined") window.location.href = "/login";
    },
  },
  functions: {
    invoke: async () => { throw disconnectedError(); },
  },
  integrations: {
    Core: {
      InvokeLLM: async () => { throw disconnectedError(); },
      UploadFile: async () => { throw disconnectedError(); },
    },
  },
  getConfig: () => ({ serverUrl: null, appId: null, requiresAuth: false }),
};
base44.asServiceRole = base44;
