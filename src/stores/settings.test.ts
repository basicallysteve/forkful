import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from './settings'
import type { User } from '@/types/User'

describe('Settings Store', () => {
  beforeEach(() => {
    // Reset the store before each test
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
      const mockUser: User = {
        user_id: 'user_123',
        username: 'testuser',
        email: 'test@example.com',
      }

      useSettingsStore.getState().setUser(mockUser)

      const { user } = useSettingsStore.getState()
      expect(user).toEqual(mockUser)
    })

    it('can set user to null', () => {
      const mockUser: User = {
        user_id: 'user_123',
        username: 'testuser',
        email: 'test@example.com',
      }

      // First set a user
      useSettingsStore.getState().setUser(mockUser)
      expect(useSettingsStore.getState().user).toEqual(mockUser)

      // Then set to null
      useSettingsStore.getState().setUser(null)
      expect(useSettingsStore.getState().user).toBeNull()
    })

    it('can update user with new data', () => {
      const user1: User = {
        user_id: 'user_123',
        username: 'testuser',
        email: 'test@example.com',
      }

      const user2: User = {
        user_id: 'user_456',
        username: 'newuser',
        email: 'new@example.com',
      }

      useSettingsStore.getState().setUser(user1)
      expect(useSettingsStore.getState().user).toEqual(user1)

      useSettingsStore.getState().setUser(user2)
      expect(useSettingsStore.getState().user).toEqual(user2)
    })
  })

  describe('logout', () => {
    it('clears the user', () => {
      const mockUser: User = {
        user_id: 'user_123',
        username: 'testuser',
        email: 'test@example.com',
      }

      // Set a user
      useSettingsStore.getState().setUser(mockUser)
      expect(useSettingsStore.getState().user).toEqual(mockUser)

      // Logout
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
