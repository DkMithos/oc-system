export const parseYYYYMMDD = (s) => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
export const formatYYYYMMDD = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const addDays = (s, n) => { const d=parseYYYYMMDD(s); d.setDate(d.getDate()+n); return formatYYYYMMDD(d); };
export const firstFridayOnOrAfter = (s) => { const d=parseYYYYMMDD(s); const delta=(5 - d.getDay() + 7) % 7; d.setDate(d.getDate()+delta); return formatYYYYMMDD(d); };
export const scheduleCredit = (fechaEmision, dias=30) => {
  const venc = addDays(fechaEmision, dias);
  return { fechaVencimiento: venc, fechaPagoProgramada: firstFridayOnOrAfter(venc) };
};
export const scheduleCash = (fechaEmision) => ({ fechaVencimiento: fechaEmision, fechaPagoProgramada: fechaEmision });
