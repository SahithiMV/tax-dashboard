// client/src/api.ts
import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import type { LotResult, Summary, WhatIfSell, HarvestCandidate } from "./types";

export type TokenOut = { access_token: string; token_type: "bearer" };
export type Me = { id: number; email: string };

const STORAGE_KEY = "taxdash_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000",
});

// Attach token only when present (works with Axios v1 headers type)
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(STORAGE_KEY);
  if (token) {
    // Set header directly, avoid replacing AxiosHeaders instance
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Small helper so pages can show clear errors
export function isAxiosError(e: unknown): e is AxiosError {
  return !!(e as AxiosError)?.isAxiosError;
}

// ---- token helpers ----
export function setToken(t: string) {
  localStorage.setItem(STORAGE_KEY, t);
}
export function getToken() {
  return localStorage.getItem(STORAGE_KEY);
}
export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---- tax profile shared types ----
export type FilingStatus = "single" | "married_joint" | "married_separate" | "head";

export type TaxProfileIn = {
  filing_status: FilingStatus;
  federal_st_rate: number;
  federal_lt_rate: number;
  state_code: string;
  state_st_rate: number;
  state_lt_rate: number;
  niit_rate: number;
  carry_forward_losses: number;
};

// ---- auth ----
export async function signup(email: string, password: string): Promise<TokenOut> {
  const { data } = await api.post<TokenOut>("/api/auth/signup", { email, password });
  setToken(data.access_token);
  return data;
}

export async function login(email: string, password: string): Promise<TokenOut> {
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

// ---- app API ----
export async function putTaxProfile(body: TaxProfileIn) {
  const { data } = await api.put("/api/tax_profile", body);
  return data;
}

export async function getTaxProfile(): Promise<TaxProfileIn> {
  const { data } = await api.get("/api/tax_profile");
  return data;
}

export async function importCsv(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/api/import/csv", form);
  return data;
}

export async function setQuotes(map: Record<string, number>) {
  const { data } = await api.put("/api/quotes", map);
  return data;
}

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
  min_loss = 50,
): Promise<HarvestCandidate[]> {
  const { data } = await api.get("/api/harvest/candidates", { params: { limit, min_loss } });
  return data;
}

// ---- AI Agent ----
export async function agentChat(message: string): Promise<{ answer: string }> {
  const { data } = await api.post("/api/agent/chat", { message });
  return data;
}

// ---- AI-powered tax profile estimation ----
// types aligned with backend TaxProfileEstimateIn
export type TaxProfileEstimateInput = {
  filing_status?: FilingStatus;
  state_code?: string;
  income_band?: "<50k" | "50-100k" | "100-200k" | "200-500k" | ">500k";
  trading_style?: "long_term" | "short_term" | "mixed";
  carry_forward_losses?: number;
  extra_notes?: string;
};

export async function estimateTaxProfile(
  input: TaxProfileEstimateInput,
): Promise<{
  tax_profile: TaxProfileIn;
  explanation: string;
}> {
  const { data } = await api.post("/api/tax_profile/estimate", input);
  return data;
}
