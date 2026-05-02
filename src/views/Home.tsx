import { cookies } from 'next/headers'
import { decrypt } from '@/lib/session'

async function Home() {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')?.value
    let username: string | null = null

    if (sessionCookie) {
        const session = await decrypt(sessionCookie).catch(() => null) as any
        if (session?.username && session?.expiresAt && new Date(session.expiresAt) > new Date()) {
            username = session.username
        }
    }

    return (
        <div className="home">
            <h1>{username ? `Welcome, ${username}!` : 'Welcome to Forkful'}</h1>
            <p>Explore delicious recipes and manage your meal plans.</p>
        </div>
    );
}

export default Home;