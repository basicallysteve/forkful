import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from './settings'
import type { User } from '@/types/User'

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user_123',
  username: 'testuser',
  email: 'test@example.com',
  hasPassword: true,
  cuisinePreferences: [],
  dietaryRestrictions: [],
  marketingEmailOptIn: false,
  recipeSuggestionFrequency: 'weekly',
  pantryExpirationFrequency: 'weekly',
  dateAdded: new Date('2024-01-01'),
  dateDeleted: null,
  ...overrides,
})

describe('Settings Store', () => {
  beforeEach(() => {
    useSettingsStore.setState({ user: null })
  })

  describe('Initial State', () => {
    it('initializes with no user', () => {
      const { user } = useSettingsStore.getState()
      expect(user).toBeNull()
    })
  })

  describe('setUser', () => {
    it('sets a user', () => {
      const mockUser = makeUser()
      useSettingsStore.getState().setUser(mockUser)
      expect(useSettingsStore.getState().user).toEqual(mockUser)
    })

    it('can set user to null', () => {
      const mockUser = makeUser()
      useSettingsStore.getState().setUser(mockUser)
      expect(useSettingsStore.getState().user).toEqual(mockUser)
      useSettingsStore.getState().setUser(null)
      expect(useSettingsStore.getState().user).toBeNull()
    })

    it('can update user with new data', () => {
      const user1 = makeUser({ id: 'user_123', username: 'testuser' })
      const user2 = makeUser({ id: 'user_456', username: 'newuser', email: 'new@example.com' })
      useSettingsStore.getState().setUser(user1)
      expect(useSettingsStore.getState().user).toEqual(user1)
      useSettingsStore.getState().setUser(user2)
      expect(useSettingsStore.getState().user).toEqual(user2)
    })
  })

  describe('logout', () => {
    it('clears the user', () => {
      const mockUser = makeUser()
      useSettingsStore.getState().setUser(mockUser)
      expect(useSettingsStore.getState().user).toEqual(mockUser)
      useSettingsStore.getState().logout()
      expect(useSettingsStore.getState().user).toBeNull()
    })

    it('can logout when no user is set', () => {
      expect(useSettingsStore.getState().user).toBeNull()
      useSettingsStore.getState().logout()
      expect(useSettingsStore.getState().user).toBeNull()
    })
  })
})
