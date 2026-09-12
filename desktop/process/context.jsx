import { createContext, useContext } from "react";
export const ProcessContext = createContext({
  processModel: null,
  setProcessModel: () => {},
});
export const ProcessProvider = ProcessContext.Provider;
export const useProcessModel = () => useContext(ProcessContext);
