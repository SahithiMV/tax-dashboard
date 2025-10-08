// client/src/api.ts
import axios, { AxiosError, AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import type { LotResult, Summary, WhatIfSell, HarvestCandidate } from "./types";

export type TokenOut = { access_token: string; token_type: "bearer" };
export type Me = { id: number; email: string };

const STORAGE_KEY = "taxdash_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000",
});

// ------- token helpers -------
export function setToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}
export function getToken() {
  return localStorage.getItem(STORAGE_KEY);
}

// ------- request interceptor: attach token ONLY to protected routes -------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const url = (config.url || "").toLowerCase();

  // Public auth endpoints: NO Authorization header here
  const isAuthRoute =
    url.includes("/api/auth/login") || url.includes("/api/auth/signup");

  if (!isAuthRoute) {
    const token = getToken();
    if (token) {
      // Axios v1: headers can be AxiosHeaders or a plain object depending on env
      if (config.headers instanceof AxiosHeaders) {
        config.headers.set("Authorization", `Bearer ${token}`);
      } else {
        config.headers = {
          ...(config.headers as Record<string, any> | undefined),
          Authorization: `Bearer ${token}`,
        } as any;
      }
    }
  }
  return config;
});

// ------- response interceptor: auto-logout on 401 -------
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(err);
  }
);

// -------- auth ----------
export async function signup(email: string, password: string): Promise<TokenOut> {
  const { data } = await api.post<TokenOut>("/api/auth/signup", { email, password });
  setToken(data.access_token);
  return data;
}

export async function login(email: string, password: string): Promise<TokenOut> {
  // FastAPI OAuth2PasswordRequestForm expects x-www-form-urlencoded: username+password
  const params = new URLSearchParams();
  params.set("username", email);
  params.set("password", password);

  const { data } = await api.post<TokenOut>("/api/auth/login", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  setToken(data.access_token);
  return data;
}

export async function me(): Promise<Me> {
  const { data } = await api.get<Me>("/api/me");
  return data;
}

// -------- portfolio API ----------
export async function getHoldings(): Promise<LotResult[]> {
  const { data } = await api.get("/api/holdings");
  return data;
}
export async function getSummary(): Promise<Summary> {
  const { data } = await api.get("/api/portfolio/summary");
  return data;
}
export async function whatIfSell(symbol: string, qty: number): Promise<WhatIfSell> {
  const { data } = await api.get("/api/whatif/sell", { params: { symbol, quantity: qty } });
  return data;
}
export async function getHarvestCandidates(
  limit = 10,
  min_loss = 50
): Promise<HarvestCandidate[]> {
  const { data } = await api.get("/api/harvest/candidates", { params: { limit, min_loss } });
  return data;
}
