import { describe, it, expect, afterAll, afterEach } from 'vitest'
import { Pool } from 'pg'
import { signUp } from './users'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`

const pool = new Pool({
  connectionString,
})

async function clearUsers() {
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
        }
        const user2 = {
            username: 'testuser2',
            email: 'testUser@gmail.com',
            password: 'password123',
        }
        await signUp(user1)
        await expect(signUp(user2)).rejects.toThrow('Email already in use')
    })

    it('should not allow duplicate username', async () => {
        const user1 = {
            username: 'testuser',
            email: 'testUser@gmail.com',
            password: 'password123',
        }
        const user2 = {
            username: 'testuser',
            email: 'testUser2@gmail.com',
            password: 'password123',
        }
        await signUp(user1)
        await expect(signUp(user2)).rejects.toThrow('Username already in use')
    })  

    it("should hash the user's password", async () => {
        const user = {
            username: 'testuser',
            email: 'testUser@gmail.com',
            password: 'password123',
        }
        const newUser = await signUp(user)
        expect(newUser.password).not.toBe(user.password)
    })
})