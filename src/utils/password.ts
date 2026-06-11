export interface PasswordValidation {
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
  isNotCommon: boolean
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'admin', 'login',
])

/**
 * Returns per-rule validation results. `isNotCommon` is vacuously true for
 * empty strings so the UI doesn't surface the rule before the user has typed.
 */
export function validatePassword(password: string): PasswordValidation {
  return {
    hasMinLength:  password.length >= 8,
    hasUppercase:  /[A-Z]/.test(password),
    hasLowercase:  /[a-z]/.test(password),
    hasNumber:     /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    isNotCommon:   password.length === 0 || !COMMON_PASSWORDS.has(password.toLowerCase()),
  }
}

/** Returns true only when every rule passes. Used by both the API and the UI. */
export function isPasswordStrong(password: string): boolean {
  const v = validatePassword(password)
  return v.hasMinLength && v.hasUppercase && v.hasLowercase &&
         v.hasNumber && v.hasSpecialChar && v.isNotCommon
}
