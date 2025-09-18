// src/firebase/adminHelpers.js
import { getFunctions, httpsCallable } from "firebase/functions";

const fns = getFunctions(undefined, "us-central1");

export const setUserPasswordAdmin = async (email, newPassword) => {
  const fn = httpsCallable(fns, "adminSetUserPassword");
  const { data } = await fn({ email, newPassword });
  return data;
};

export const setUserRoleAdmin = async (email, newRole) => {
  const fn = httpsCallable(fns, "adminSetUserRole");
  const { data } = await fn({ email, newRole });
  return data;
};

export const setUserEstadoAdmin = async (email, estado) => {
  const fn = httpsCallable(fns, "adminSetUserEstado");
  const { data } = await fn({ email, estado });
  return data;
};
