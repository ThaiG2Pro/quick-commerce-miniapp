// Lightweight wrapper that lazy-loads zmp-sdk/apis to avoid executing it at module import time.
// Callers should import functions from here instead of importing from 'zmp-sdk/apis' directly.

export async function getZmpApis() {
  return await import("zmp-sdk/apis");
}

export async function authorize(...args: any[]) {
  const mod = await getZmpApis();
  return mod.authorize?.(...args);
}

export async function getAccessToken(...args: any[]) {
  const mod = await getZmpApis();
  return mod.getAccessToken?.(...args);
}

export async function getUserInfo(...args: any[]) {
  const mod = await getZmpApis();
  return mod.getUserInfo?.(...args);
}

export async function openChat(...args: any[]) {
  const mod = await getZmpApis();
  return mod.openChat?.(...args);
}

export async function getLocation(...args: any[]) {
  const mod = await getZmpApis();
  return mod.getLocation?.(...args);
}

export async function getPhoneNumber(...args: any[]) {
  const mod = await getZmpApis();
  return mod.getPhoneNumber?.(...args);
}

export async function showOAWidget(...args: any[]) {
  const mod = await getZmpApis();
  return mod.showOAWidget?.(...args);
}

export async function openShareSheet(...args: any[]) {
  const mod = await getZmpApis();
  return mod.openShareSheet?.(...args);
}
