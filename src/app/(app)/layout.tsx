import NavBar from '@/components/NavBar'
import LastSeenUpdater from '@/components/LastSeenUpdater'
import PageTransition from '@/components/PageTransition'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LastSeenUpdater />
      <div className="bg-bg pt-[env(safe-area-inset-top)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-6">
        <PageTransition>{children}</PageTransition>
      </div>
      <NavBar />
    </>
  )
}
