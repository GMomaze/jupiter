export function normalizeModelIdentity(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function formatModelDisplay(model: {
  model_code?: string | null;
  model_name?: string | null;
}) {
  const modelCode = normalizeModelIdentity(model.model_code);
  const modelName = normalizeModelIdentity(model.model_name);

  if (modelCode && modelName && modelCode.toUpperCase() !== modelName.toUpperCase()) {
    return `${modelCode} — ${modelName}`;
  }

  return modelCode || modelName || '-';
}
