import { useState } from 'react'
import './App.css'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <h1>Hello World</h1>

    <SignedOut>
      <SignInButton mode='modal' />
    </SignedOut>
    <SignedIn>
       <UserButton />
    </SignedIn>
    </>
  )
}

export default App
