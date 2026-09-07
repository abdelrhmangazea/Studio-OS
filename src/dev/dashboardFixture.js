/**
 * A believable studio, generated relative to today, for the dashboard
 * preview at /dev/dashboard. Development only — App.jsx never
 * registers the route in a production build.
 *
 * Shaped exactly like loadDashboardData()'s result so DashboardView
 * cannot tell the difference.
 */

const DAY = 86400000
const ago = (days, hour = 10) => {
  const d = new Date(Date.now() - days * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
const plainDate = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)

const STAGES = [
  ['01_consultation', 'Design Consultation', 'الاستشارة التصميمية'],
  ['02_fee_proposal', 'Fee Proposal', 'عرض الأتعاب'],
  ['03_contract', 'Contract & First Payment', 'العقد والدفعة الأولى'],
  ['04_onboarding', 'Client Onboarding', 'استقبال العميل'],
  ['05_concept', 'Concept', 'الكونسبت'],
  ['06_design_development', 'Design Development', 'تطوير التصميم'],
  ['07_tender_ffe', 'Tender & FF&E', 'المناقصة والتأثيث'],
  ['08_construction', 'Construction', 'التنفيذ'],
  ['09_delivered', 'Delivered', 'التسليم'],
  ['10_followup', 'Follow-up', 'المتابعة'],
]

const SOURCES = [
  ['s1', 'Instagram', 'إنستجرام'],
  ['s2', 'Referral', 'ترشيح'],
  ['s3', 'Website', 'الموقع'],
  ['s4', 'WhatsApp', 'واتساب'],
]

// [first, last, source, created days ago, lastContact days ago, isClient]
const PEOPLE = [
  ['دينا', 'مرسي', 's1', 3, 1, false],
  ['فهد', 'العتيبي', 's2', 9, 2, false],
  ['عمر', 'الزرعوني', 's3', 14, 4, true],
  ['سارة', 'الجندي', 's1', 22, 3, true],
  ['نورة', 'باعشن', 's1', 31, 6, true],
  ['طارق', 'شلبي', 's2', 38, 9, true],
  ['بدر', 'الصباح', 's3', 47, 5, true],
  ['هالة', 'نصّار', 's4', 55, 12, true],
  ['يوسف', 'الديب', 's2', 63, 8, true],
  ['منى', 'الحديدي', 's1', 78, 21, true],
  ['أحمد', 'رشدي', 's4', 84, 2, false],
  ['ليلى', 'عبد الرحمن', 's1', 96, 40, true],
  ['كريم', 'فوزي', 's3', 110, 15, false],
  ['ريم', 'الشمري', 's1', 124, 30, true],
  ['حسام', 'الخطيب', 's2', 140, 60, false],
  ['مريم', 'سلامة', 's1', 158, 90, true],
  ['زياد', 'العمري', 's4', 171, 70, false],
  ['جنى', 'الراشد', 's1', 190, 100, true],
  ['عادل', 'منصور', 's3', 205, 120, false],
  ['رنا', 'حجازي', 's2', 226, 130, true],
  ['سيف', 'الدوسري', 's1', 244, 150, false],
  ['هدى', 'بركات', 's1', 263, 160, true],
  ['ماجد', 'القحطاني', 's3', 281, 170, false],
  ['نادين', 'عاشور', 's2', 299, 180, true],
  ['وليد', 'حمدان', 's4', 318, 200, false],
  ['شهد', 'المطيري', 's1', 336, 210, true],
  ['رامي', 'سعيد', 's1', 352, 220, false],
]

// [code, name, contact index, stage index (0-based), state, area, days old, delivered days ago]
const PROJECTS = [
  ['P-0031', 'شقة الشيخ زايد', 2, 0, 'on_track', 180, 14, null],
  ['P-0030', 'فيلا التجمع الخامس', 3, 1, 'waiting_client', 420, 22, null],
  ['P-0029', 'بنتهاوس الزمالك', 4, 2, 'needs_attention', 260, 31, null],
  ['P-0028', 'عيادة أسنان — المعادي', 5, 3, 'on_track', 140, 38, null],
  ['P-0027', 'شاليه الساحل', 6, 4, 'on_track', 210, 47, null],
  ['P-0026', 'فيلا الرياض — حي الياسمين', 7, 5, 'on_track', 520, 55, null],
  ['P-0025', 'مكتب دبي مارينا', 8, 6, 'waiting_client', 330, 63, null],
  ['P-0024', 'دوبلكس مدينتي', 9, 7, 'on_track', 300, 78, null],
  ['P-0023', 'استوديو نيو كايرو', 11, 7, 'on_hold', 95, 96, null],
  ['P-0022', 'شقة مصر الجديدة', 13, 8, 'on_track', 170, 124, 6],
  ['P-0021', 'فيلا الشروق', 15, 9, 'on_track', 380, 158, 60],
  ['P-0019', 'مطعم وسط البلد', 17, 9, 'closed', 220, 190, 150],
]

// [project index, amount, days ago, status]
const INVOICES = [
  [0, 12000, 2, 'sent'],
  [2, 96000, 4, 'sent'],
  [3, 42000, 9, 'paid'],
  [5, 156000, 18, 'paid'],
  [4, 63000, 27, 'paid'],
  [6, 99000, 41, 'paid'],
  [7, 90000, 52, 'sent'],
  [7, 90000, 66, 'paid'],
  [9, 51000, 74, 'paid'],
  [8, 28500, 92, 'paid'],
  [10, 114000, 101, 'paid'],
  [9, 51000, 118, 'paid'],
  [10, 114000, 139, 'paid'],
  [11, 66000, 155, 'paid'],
  [10, 114000, 172, 'paid'],
  [11, 66000, 198, 'paid'],
  [11, 66000, 231, 'paid'],
  [11, 40000, 262, 'paid'],
  [10, 76000, 290, 'paid'],
  [11, 55000, 325, 'paid'],
]

export function buildFixture({ empty = false } = {}) {
  const definitions = STAGES.map(([stage_key, title_en, title_ar], i) => ({
    stage_key, title_en, title_ar, sort_order: i + 1,
  }))
  if (empty) {
    return {
      projects: [], definitions, contacts: [], tasks: [], reminders: [], bookings: [],
      pairs: [], invoices: [], contractStages: [], sources: [], stages: [], items: [],
      occasionGaps: [],
    }
  }

  const sources = SOURCES.map(([id, label_en, label_ar]) => ({ id, label_en, label_ar }))
  const contacts = PEOPLE.map(([first_name, last_name, source_id, created, last, is_client], i) => ({
    id: `c${i}`,
    first_name,
    last_name,
    source_id,
    is_client,
    created_at: ago(created),
    converted_at: is_client ? ago(Math.max(created - 5, 1)) : null,
    last_contact_at: ago(last),
  }))

  const projects = PROJECTS.map(([code, name, ci, stage, state, area, old, delivered], i) => ({
    id: `p${i}`,
    code,
    name,
    contact_id: `c${ci}`,
    contact: { id: `c${ci}`, first_name: contacts[ci].first_name, last_name: contacts[ci].last_name },
    current_stage: STAGES[stage][0],
    state,
    value: stage === 0 ? null : area * 1200,
    // Delivered work is archived — off the active list, still a client.
    is_archived: state === 'closed' || delivered !== null,
    created_at: ago(old),
    delivered_at: delivered === null ? null : ago(delivered),
  }))

  const stages = []
  const items = []
  const contractStages = []
  projects.forEach((project, pi) => {
    const current = PROJECTS[pi][3]
    STAGES.forEach(([stage_key], si) => {
      const status = si < current ? 'complete' : si === current ? 'active' : 'locked'
      stages.push({ project_id: project.id, stage_key, sort_order: si + 1, status })
      if (si === 2 && si < current) {
        contractStages.push({ project_id: project.id, stage_key, completed_at: ago(PROJECTS[pi][6] - (current - 2) * 6) })
      }
    })
    // A few checklist items in the open stage, partly done.
    const doneCount = [3, 1, 4, 2, 5, 3, 1, 4, 2, 6, 0, 0][pi]
    for (let k = 0; k < 6; k += 1) {
      items.push({ project_id: project.id, stage_key: STAGES[current][0], is_done: k < doneCount })
    }
  })

  const invoices = INVOICES.map(([pi, amount, days, status], i) => ({
    id: `i${i}`,
    project_id: `p${pi}`,
    contact_id: projects[pi].contact_id,
    amount,
    status,
    issued_at: ago(days),
    created_at: ago(days),
  }))

  const bookingFor = [2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 15, 17, 19, 21, 1]
  const bookings = bookingFor.map((ci, i) => ({
    id: `b${i}`,
    contact_id: `c${ci}`,
    client_name: `${contacts[ci].first_name} ${contacts[ci].last_name}`,
    status: i === 14 ? 'confirmed' : 'completed',
    created_at: ago(PEOPLE[ci][3] - 2),
    slot_start: i === 14 ? ago(0, 15) : ago(PEOPLE[ci][3] - 4, 12),
    project: null,
  }))
  bookings.push({
    id: 'b-next',
    contact_id: 'c0',
    client_name: 'دينا مرسي',
    status: 'confirmed',
    created_at: ago(1),
    slot_start: ago(-2, 13),
    project: null,
  })

  const task = (id, title, due, pi, ci) => ({
    id,
    title,
    due_date: due,
    project: pi === null ? null : { id: `p${pi}`, code: PROJECTS[pi][0], name: PROJECTS[pi][1] },
    contact: ci === null ? null : { id: `c${ci}`, first_name: contacts[ci].first_name, last_name: contacts[ci].last_name },
  })
  const tasks = [
    task('t1', 'إرسال عرض الأتعاب المعدّل', plainDate(0), 1, 3),
    task('t2', 'مراجعة لوحة الخامات قبل الاجتماع', plainDate(0), 5, 7),
    task('t3', 'متابعة الدفعة الأولى', plainDate(-3), 2, 4),
    task('t4', 'زيارة موقع — الجبس والدهانات', plainDate(2), 7, 9),
    task('t5', 'اعتماد رسومات الإضاءة', plainDate(4), 6, 8),
    task('t6', 'تجهيز حقيبة الترحيب', plainDate(6), 3, 5),
  ]

  const reminders = [
    { id: 'r1', kind: 'followup_6m', due_date: plainDate(0), contact_id: 'c10', contact: contacts[10], recurring: false },
    { id: 'r2', kind: 'birthday', due_date: plainDate(3), contact_id: 'c13', contact: contacts[13], recurring: true },
  ]

  return {
    projects, definitions, contacts, tasks, reminders, bookings,
    pairs: [], invoices, contractStages, sources, stages, items,
    occasionGaps: [],
  }
}
