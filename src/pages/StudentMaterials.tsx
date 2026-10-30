import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { openFile } from '../lib/storage'

type Material = {
  id: string
  title: string
  description: string | null
  storage_path: string
  subjects: { name: string } | null
}

const subjectColors = [
  'material-purple',
  'material-blue',
  'material-green',
  'material-orange',
  'material-pink',
]

function fileInfo(path: string) {
  const filename = path.split('/').pop() ?? ''
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf') return { icon: '📕', label: 'PDF DOCUMENT' }
  if (['doc', 'docx'].includes(ext)) {
    return { icon: '📝', label: 'WORD DOCUMENT' }
  }
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return { icon: '🖼️', label: 'IMAGE' }
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return { icon: '📊', label: 'PRESENTATION' }
  }

  return { icon: '📄', label: 'STUDY RESOURCE' }
}


export default function StudentMaterials() {
  const [list, setList] = useState<Material[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All subjects')
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadMaterials() {
      setLoading(true)

      const { data, error } = await supabase
        .from('learning_materials')
        .select('id,title,description,storage_path,subjects(name)')
        .order('created_at', { ascending: false })

      if (!active) return

      if (error) {
        setMsg('We couldn’t load your study materials. Please try again.')
      } else {
        setList((data ?? []) as unknown as Material[])
      }

      setLoading(false)
    }

    loadMaterials()

    return () => {
      active = false
    }
  }, [])

  const subjects = useMemo(
    () => [
      'All subjects',
      ...Array.from(
        new Set(list.map((item) => item.subjects?.name).filter(Boolean) as string[]),
      ).sort(),
    ],
    [list],
  )

  const filteredMaterials = useMemo(() => {
    const query = search.trim().toLowerCase()

    return list.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        (item.description ?? '').toLowerCase().includes(query) ||
        (item.subjects?.name ?? '').toLowerCase().includes(query)

      const matchesSubject =
        subjectFilter === 'All subjects' ||
        item.subjects?.name === subjectFilter

      return matchesSearch && matchesSubject
    })
  }, [list, search, subjectFilter])

  async function handleOpen(material: Material) {
    setMsg('')
    setOpeningId(material.id)

    try {
      const opened = await openFile('materials', material.storage_path)

      if (!opened) {
        setMsg(`We couldn’t open "${material.title}". Please try again.`)
      }
    } catch {
      setMsg(`We couldn’t open "${material.title}". Please try again.`)
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <div className="materials-page">
      <section className="materials-hero">
        <div className="materials-hero-copy">
          <span className="materials-eyebrow">YOUR LEARNING SPACE ✨</span>
          <h1>Study Materials</h1>
          <p>
            Every little step counts! Find your notes, explore your subjects,
            and keep learning at your own pace.
          </p>

          <div className="materials-hero-stats">
            <div>
              <strong>{list.length}</strong>
              <span>Resources</span>
            </div>
            <div>
              <strong>{Math.max(subjects.length - 1, 0)}</strong>
              <span>Subjects</span>
            </div>
          </div>
        </div>

        <div className="materials-hero-art" aria-hidden="true">
          <div className="materials-art-circle">📚</div>
          <span className="materials-float materials-float-one">✏️</span>
          <span className="materials-float materials-float-two">⭐</span>
          <span className="materials-float materials-float-three">💡</span>
        </div>
      </section>

      <section className="materials-toolbar">
        <div className="materials-section-heading">
          <div>
            <span className="materials-kicker">READY TO LEARN?</span>
            <h2>Your learning library</h2>
          </div>
          <span className="materials-count">
            {filteredMaterials.length} {filteredMaterials.length === 1 ? 'resource' : 'resources'}
          </span>
        </div>

        <div className="materials-filters">
          <label className="materials-search">
            <span aria-hidden="true">🔎</span>
            <input
              type="search"
              placeholder="Search notes, topics, subjects..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search study materials"
            />
          </label>

          <select
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
            aria-label="Filter by subject"
            className="materials-subject-filter"
          >
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>
      </section>

      {msg && (
        <div className="materials-message" role="alert">
          <span>💛</span>
          <p>{msg}</p>
          <button onClick={() => setMsg('')} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="materials-empty">
          <span className="materials-empty-icon">📚</span>
          <h3>Getting your books ready...</h3>
          <p>Your learning library will be here in a moment.</p>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="materials-empty">
          <span className="materials-empty-icon">
            {search || subjectFilter !== 'All subjects' ? '🔎' : '🎒'}
          </span>
          <h3>
            {search || subjectFilter !== 'All subjects'
              ? 'No matching materials'
              : 'Your library is waiting!'}
          </h3>
          <p>
            {search || subjectFilter !== 'All subjects'
              ? 'Try another search or choose a different subject.'
              : 'Your teacher’s shared notes and resources will appear here.'}
          </p>

          {(search || subjectFilter !== 'All subjects') && (
            <button
              className="materials-reset-button"
              onClick={() => {
                setSearch('')
                setSubjectFilter('All subjects')
              }}
            >
              Show all materials
            </button>
          )}
        </div>
      ) : (
        <section className="materials-grid" aria-label="Study materials">
          {filteredMaterials.map((material, index) => {
            const file = fileInfo(material.storage_path)

            return (
              <article
                key={material.id}
                className={`material-card ${subjectColors[index % subjectColors.length]}`}
              >
                <div className="material-card-top">
                  <div className="material-file-icon" aria-hidden="true">
                    {file.icon}
                  </div>
                  <span className="material-file-type">{file.label}</span>
                </div>

                <div className="material-card-content">
                  <span className="material-subject">
                    {material.subjects?.name ?? 'General'}
                  </span>

                  <h3>{material.title}</h3>

                  <p className="material-description">
                    {material.description || 'A learning resource to help you revise and practise.'}
                  </p>
                </div>

                <div className="material-card-bottom">
                  <span className="material-ready">
                    <span aria-hidden="true">●</span> Ready to study
                  </span>

                  <button
                    className="material-open-button"
                    onClick={() => handleOpen(material)}
                    disabled={openingId === material.id}
                  >
                    {openingId === material.id ? 'Opening...' : 'Open material ↗'}
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      )}

      <footer className="materials-footer-note">
        <span aria-hidden="true">🌱</span>
        <p>
          Learn something new every day. You’re doing better than you think!
        </p>
      </footer>
    </div>
  )
}