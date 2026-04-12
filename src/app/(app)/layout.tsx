import NavBar from '@/components/NavBar'
import LastSeenUpdater from '@/components/LastSeenUpdater'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LastSeenUpdater />
      <div className="bg-bg pb-24">
        {children}
      </div>
      <NavBar />
    </>
  )
}
