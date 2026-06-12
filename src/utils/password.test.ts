import { describe, it, expect } from 'vitest'
import { validatePassword, isPasswordStrong } from './password'

describe('validatePassword', () => {
  it('returns all false for an empty string (except isNotCommon which is vacuously true)', () => {
    const v = validatePassword('')
    expect(v.hasMinLength).toBe(false)
    expect(v.hasUppercase).toBe(false)
    expect(v.hasLowercase).toBe(false)
    expect(v.hasNumber).toBe(false)
    expect(v.hasSpecialChar).toBe(false)
    expect(v.isNotCommon).toBe(true) // vacuously true so UI stays quiet
  })

  it('correctly flags each rule independently', () => {
    expect(validatePassword('short').hasMinLength).toBe(false)
    expect(validatePassword('longenough').hasMinLength).toBe(true)

    expect(validatePassword('nouppercase1!').hasUppercase).toBe(false)
    expect(validatePassword('HasUpper1!').hasUppercase).toBe(true)

    expect(validatePassword('NOLOWER1!').hasLowercase).toBe(false)
    expect(validatePassword('HasLower1!').hasLowercase).toBe(true)

    expect(validatePassword('NoNumber!').hasNumber).toBe(false)
    expect(validatePassword('HasNumber1!').hasNumber).toBe(true)

    expect(validatePassword('NoSpecial1').hasSpecialChar).toBe(false)
    expect(validatePassword('HasSpecial1!').hasSpecialChar).toBe(true)
  })

  it('marks common passwords as invalid', () => {
    expect(validatePassword('password').isNotCommon).toBe(false)
    expect(validatePassword('PASSWORD').isNotCommon).toBe(false) // case-insensitive
    expect(validatePassword('qwerty123').isNotCommon).toBe(false)
  })

  it('marks non-common passwords as valid', () => {
    expect(validatePassword('Str0ng!Pass').isNotCommon).toBe(true)
    expect(validatePassword('MyUniq1!Word').isNotCommon).toBe(true)
  })
})

describe('isPasswordStrong', () => {
  it('returns true for a fully valid password', () => {
    expect(isPasswordStrong('Str0ng!Pass')).toBe(true)
    expect(isPasswordStrong('C0rrectH0rse!')).toBe(true)
  })

  it('returns false when any single rule is violated', () => {
    expect(isPasswordStrong('str0ng!pass')).toBe(false)   // no uppercase
    expect(isPasswordStrong('STR0NG!PASS')).toBe(false)   // no lowercase
    expect(isPasswordStrong('Strongpass!')).toBe(false)   // no number
    expect(isPasswordStrong('Str0ngPass')).toBe(false)    // no special char
    expect(isPasswordStrong('Sh0rt!')).toBe(false)        // too short
    expect(isPasswordStrong('password')).toBe(false)      // common + missing rules
  })
})
