import { useState } from 'react'
import { useI18n } from '../i18n'
import { Tabs } from '../components/ui'
import Bookings from './Bookings'
import BookingSetup from './BookingSetup'

/**
 * Bookings and Booking Setup share one sidebar item.
 *
 * The spec fixes the sidebar at ten screens, and the inbox is not one of
 * them — so rather than adding an eleventh, the incoming bookings and
 * the settings that produce them live behind the same entry.
 */
export default function BookingHome() {
  const { t } = useI18n()
  const [tab, setTab] = useState('inbox')

  return (
    <div>
      <Tabs
        tabs={[
          { key: 'inbox', label: t('nav.bookings') },
          { key: 'setup', label: t('booking.setupTab') },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="pt-6">{tab === 'inbox' ? <Bookings /> : <BookingSetup />}</div>
    </div>
  )
}
