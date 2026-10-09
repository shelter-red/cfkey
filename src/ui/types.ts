export type SessionState = {
  ready: boolean;
  required: string[];
  missing: string[];
  authenticated: boolean;
};

export type ViewMode = "all" | "favorites" | "trash";

export type FormState = {
  id: string;
  name: string;
  type: string;
  provider: string;
  category: string;
  tags: string;
  favorite: boolean;
  fields: Record<string, string>;
  notes: string;
};

export type SelectOption = { label: string; value: string };
