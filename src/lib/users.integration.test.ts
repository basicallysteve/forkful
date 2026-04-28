import { describe, it, expect, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { signUp, login, trackLoginAttempt } from './users'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`

const pool = new Pool({
  connectionString,
})

async function clearUsers() {
  await pool.query("DELETE FROM login_attempts");
  await pool.query("DELETE FROM users WHERE username LIKE 'test%'");
}

describe('users integration tests', () => {
    afterEach(async () => {
        await clearUsers()
    })
    afterAll(async () => {
        await pool.end()
    })

    it('should sign up a new user', async () => {
        const user = {
            username: 'testuser',
            email: 'testUser@gmail.com',
            password: 'password123',
            cuisinePreferences: [],
            dietaryRestrictions: [],
        }
        const newUser = await signUp(user)
        expect(newUser.username).toBe(user.username)
        expect(newUser.email).toBe(user.email)
    })

    it('should not allow duplicate email', async () => {
        const user1 = {
            username: 'testuser1',
            email: 'testUser@gmail.com',
            password: 'password123',
            cuisinePreferences: [],
            dietaryRestrictions: [],
        }
        const user2 = {
            username: 'testuser2',
            email: 'testUser@gmail.com',
            password: 'password123',
            cuisinePreferences: [],
            dietaryRestrictions: [],
        }
        await signUp(user1)
        await expect(signUp(user2)).rejects.toThrow('Email already in use')
    })

    it('should not allow duplicate username', async () => {
        const user1 = {
            username: 'testuser',
            email: 'testUser@gmail.com',
            password: 'password123',
            cuisinePreferences: [],
            dietaryRestrictions: [],
        }
        const user2 = {
            username: 'testuser',
            email: 'testUser2@gmail.com',
            password: 'password123',
            cuisinePreferences: [],
            dietaryRestrictions: [],
        }
        await signUp(user1)
        await expect(signUp(user2)).rejects.toThrow('Username already in use')
    })  

    it("should hash the user's password", async () => {
        const user = {
            username: 'testuser',
            email: 'testUser@gmail.com',
            password: 'password123',
            cuisinePreferences: [],
            dietaryRestrictions: [],
        }
        const newUser = await signUp(user)
        expect(newUser.password).not.toBe(user.password)
    })

    it('should store cuisine preferences and dietary restrictions', async () => {
        const user = {
            username: 'testuser',
            email: 'testUser@gmail.com',
            password: 'password123',
            cuisinePreferences: ['Italian', 'Mexican'],
            dietaryRestrictions: ['Vegetarian', 'Gluten-Free'],
        }
        const newUser = await signUp(user)
        expect(newUser.cuisinePreferences).toEqual(user.cuisinePreferences)
        expect(newUser.dietaryRestrictions).toEqual(user.dietaryRestrictions)
    })

    it('should login a user successfully', async () => {
        const user = {
            username: 'testlogin',
            email: 'testlogin@gmail.com',
            password: 'password123',
            cuisinePreferences: [],
            dietaryRestrictions: []
        }
        await signUp(user)
        const loggedIn = await login('testlogin', 'password123')
        expect(loggedIn.username).toBe('testlogin')
    })

    it('should reject login for non-existent user', async () => {
        await expect(login('testnonexistent', 'password123')).rejects.toThrow('Invalid username or password')
    })

    it('should reject login with wrong password', async () => {
        const user = {
            username: 'testlogin2',
            email: 'testlogin2@gmail.com',
            password: 'password123',
            cuisinePreferences: [],
            dietaryRestrictions: []
        }
        await signUp(user)
        await expect(login('testlogin2', 'wrongpassword')).rejects.toThrow('Invalid username or password')
    })

    it('should block login after 5 failed attempts', async () => {
        const user = { 
            username: 'testlogin3', 
            email: 'testlogin3@gmail.com', 
            password: 'password123', 
            cuisinePreferences: [], 
            dietaryRestrictions: [] 
        }
        const newUser = await signUp(user)

        for (let i = 0; i < 5; i++) {
            await trackLoginAttempt({ userId: Number(newUser.id), successful: false, ipAddress: '127.0.0.1' })
        }

        await expect(login('testlogin3', 'password123')).rejects.toThrow('Too many failed login attempts. Please try again later.')
    })
})