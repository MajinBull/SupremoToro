import { createContext, useContext } from "react";

/** Contesto intestazione grafici multipli: stesso valore che prima passava `<Outlet context />`. */
export const LayoutChartsContext = createContext(null);

export function useLayoutChartsContext() {
  return useContext(LayoutChartsContext) ?? {};
}
