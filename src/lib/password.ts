export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 10 characters",
    test: (value) => value.length >= 10,
  },
  {
    id: "lower",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "upper",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "number",
    label: "One number",
    test: (value) => /\d/.test(value),
  },
  {
    id: "special",
    label: "One special character",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

export function passwordMeetsRules(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

export function passwordRuleMessage(): string {
  return "Password needs 10+ characters, upper and lowercase, a number, and a special character.";
}
