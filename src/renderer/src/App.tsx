import { useState } from 'react'
import { createHashRouter, RouterProvider, Navigate } from 'react-router'
import { AppLayout } from '@/layouts/AppLayout'
import { Marketplace } from '@/pages/Marketplace'
import { Workspace } from '@/pages/Workspace'
import { ImageManager } from '@/pages/ImageManager'
import { Settings } from '@/pages/Settings'
import { SetupWizard, isFirstRun } from '@/components/SetupWizard'

const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/marketplace" replace /> },
      { path: 'marketplace', element: <Marketplace /> },
      { path: 'workspace', element: <Workspace /> },
      { path: 'images', element: <ImageManager /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/marketplace" replace /> }
    ]
  }
])

export function App(): JSX.Element {
  const [showWizard, setShowWizard] = useState(isFirstRun())

  return (
    <>
      {showWizard && <SetupWizard onComplete={() => setShowWizard(false)} />}
      <RouterProvider router={router} />
    </>
  )
}
