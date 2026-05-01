import { NextResponse } from "next/dist/server/next";
import { cookies } from "next/headers";
import { deleteSession } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')

  if (sessionCookie) {
    await deleteSession(sessionCookie.value)
    cookieStore.set('session', '', { httpOnly: true, secure: true, sameSite: 'strict', expires: new Date(0) })
  }

  return NextResponse.json({ message: 'Logged out successfully' }, { status: 200 })
}