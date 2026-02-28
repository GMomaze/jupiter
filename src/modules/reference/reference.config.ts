export const ReferenceGovernance = {
  rf_role: { allow_runtime_create: false },           // Roles are code-dependent
  rf_task_state: { allow_runtime_create: false },     // Lifecycle is immutable
  rf_workpack_status: { allow_runtime_create: false }, 
  rf_component_condition: { allow_runtime_create: true }, // Users can add conditions
  rf_signoff_role: { allow_runtime_create: false },
  rf_aircraft_category: { allow_runtime_create: true },
  rf_component_type: { allow_runtime_create: true },
} as const;