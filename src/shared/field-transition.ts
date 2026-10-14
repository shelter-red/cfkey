import { TEMPLATE_BY_ID } from "./templates";

export type TemplateTransitionPlan = {
  fields: Record<string, string>;
  preserved: string[];
  dropped: string[];
};

/**
 * Keeps values whose field id exists in the target template and reports the
 * user-visible labels that will be preserved or discarded.
 */
export function planTemplateTransition(
  fields: Record<string, string>,
  fromTemplateId: string,
  toTemplateId: string,
): TemplateTransitionPlan {
  const source = TEMPLATE_BY_ID.get(fromTemplateId);
  const target = TEMPLATE_BY_ID.get(toTemplateId);
  const targetFields = new Map(target?.fields.map((field) => [field.id, field]) ?? []);
  const nextFields = Object.fromEntries(
    Object.entries(fields).filter(([fieldId]) => targetFields.has(fieldId)),
  );
  const preserved = target?.fields
    .filter((field) => Object.prototype.hasOwnProperty.call(fields, field.id))
    .map((field) => field.label) ?? [];
  const sourceLabels = new Map(source?.fields.map((field) => [field.id, field.label]) ?? []);
  const dropped = Object.keys(fields)
    .filter((fieldId) => !targetFields.has(fieldId))
    .map((fieldId) => sourceLabels.get(fieldId) ?? fieldId);

  return { fields: nextFields, preserved, dropped };
}
