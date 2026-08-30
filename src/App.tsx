import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './ui/Sidebar'
import { UnitEditor } from './ui/UnitEditor'
import { EstimatePanel } from './ui/EstimatePanel'
import { ProjectPanel } from './ui/ProjectPanel'
import { OfferModal, ShareModal } from './ui/modals'
import { Viewer, type ViewerHandle } from './ui/Viewer'
import { PRESETS, demoProject, makeUnit, uid } from './domain/presets'
import { deleteProject, listProjects, recallLast, rememberLast, saveProject, type SavedProject } from './domain/storage'
import { estimateProject, formatMoney } from './domain/estimate'
import type { Project, Unit, UnitKind } from './domain/types'
import type { CameraPreset, ViewOptions } from './viewer/scene'

type Tab = 'unit' | 'estimate' | 'project'

const CAMERA_BUTTONS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'iso', label: 'Обзор' },
  { id: 'front', label: 'Фронт' },
  { id: 'top', label: 'Сверху' },
  { id: 'inside', label: 'В комнате' },
]

export interface AppProps {
  /** Проект из ссылки: читается до первого рендера, чтобы клиент не видел чужой демо-проект. */
  initialProject: Project | null
  initialClientMode: boolean
}

export default function App({ initialProject, initialClientMode }: AppProps) {
  const [project, setProject] = useState<Project>(() => initialProject ?? recallLast() ?? demoProject())
  const [projectId, setProjectId] = useState(() => uid('proj'))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(initialClientMode ? 'estimate' : 'unit')
  const [clientMode] = useState(initialClientMode)
  const [saved, setSaved] = useState<SavedProject[]>([])
  const [modal, setModal] = useState<'share' | 'offer' | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [options, setOptions] = useState<ViewOptions>(() => ({
    showRoom: true,
    showDimensions: false,
    openFronts: false,
    // На телефонах и планшетах тяжёлый проход выключен: важнее плавность.
    realistic: !(window.matchMedia?.('(pointer: coarse)').matches ?? false),
  }))

  const viewerRef = useRef<ViewerHandle>(null)
  const hasUnits = useRef(false)
  hasUnits.current = project.units.length > 0

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => {
    setSaved(listProjects())
  }, [])

  // Автосохранение черновика.
  useEffect(() => {
    if (clientMode) return
    const timer = window.setTimeout(() => rememberLast(project), 400)
    return () => window.clearTimeout(timer)
  }, [project, clientMode])

  useEffect(() => {
    if (!selectedId && project.units.length) setSelectedId(project.units[0].id)
    if (selectedId && !project.units.some((u) => u.id === selectedId)) {
      setSelectedId(project.units[0]?.id ?? null)
    }
  }, [project.units, selectedId])

  const selectedUnit = useMemo(
    () => project.units.find((u) => u.id === selectedId) ?? null,
    [project.units, selectedId],
  )

  const estimate = useMemo(() => estimateProject(project), [project])

  const patchProject = useCallback((patch: Partial<Project>) => {
    setProject((prev) => ({ ...prev, ...patch }))
  }, [])

  const patchUnit = useCallback((id: string, patch: Partial<Unit>) => {
    setProject((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    }))
  }, [])

  const handleMove = useCallback((id: string, x: number, z: number) => {
    setProject((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === id ? { ...u, x, z } : u)),
    }))
  }, [])

  const addUnit = useCallback((kind: UnitKind) => {
    setProject((prev) => {
      const last = prev.units[prev.units.length - 1]
      const nextX = last ? last.x + last.width : 0
      const unit = makeUnit({
        kind,
        name: kind === 'wall' ? 'Навесной шкаф' : kind === 'tall' ? 'Пенал' : 'Напольная тумба',
        x: nextX,
        materials: last?.materials,
        handle: last?.handle,
      })
      setSelectedId(unit.id)
      return { ...prev, units: [...prev.units, unit] }
    })
    setTab('unit')
  }, [])

  const duplicateUnit = useCallback(() => {
    if (!selectedUnit) return
    const copy: Unit = {
      ...structuredClone(selectedUnit),
      id: uid('u'),
      x: selectedUnit.x + selectedUnit.width,
    }
    copy.sections = copy.sections.map((s) => ({ ...s, id: uid('s') }))
    setProject((prev) => ({ ...prev, units: [...prev.units, copy] }))
    setSelectedId(copy.id)
  }, [selectedUnit])

  const removeUnit = useCallback(() => {
    if (!selectedUnit) return
    setProject((prev) => ({ ...prev, units: prev.units.filter((u) => u.id !== selectedUnit.id) }))
  }, [selectedUnit])

  const applyPreset = useCallback((presetId: string, replace: boolean) => {
    const preset = PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    if (replace && hasUnits.current && !window.confirm('Заменить весь проект этим изделием? Текущие модули будут удалены.')) return
    const units = preset.build()
    setProject((prev) => {
      if (replace) return { ...prev, units }
      const shift = prev.units.reduce((max, u) => Math.max(max, u.x + u.width), 0)
      const shifted = units.map((u) => ({ ...u, x: u.x + shift + (prev.units.length ? 100 : 0) }))
      return { ...prev, units: [...prev.units, ...shifted] }
    })
    setSelectedId(units[0]?.id ?? null)
    setTab('unit')
    notify(replace ? 'Проект заменён' : 'Изделие добавлено')
  }, [notify])

  const handleSave = useCallback(() => {
    setSaved(saveProject(projectId, project))
    notify('Проект сохранён в браузере')
  }, [project, projectId, notify])

  const loadSaved = useCallback((id: string) => {
    const item = listProjects().find((p) => p.id === id)
    if (!item) return
    setProject(item.project)
    setProjectId(item.id)
    setSelectedId(item.project.units[0]?.id ?? null)
    notify('Проект загружен')
  }, [notify])

  const removeSaved = useCallback((id: string) => {
    setSaved(deleteProject(id))
  }, [])

  const downloadPng = useCallback(() => {
    const url = viewerRef.current?.snapshot()
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name || 'proekt'}.png`
    link.click()
    notify('Картинка сохранена')
  }, [project.name, notify])

  const openOffer = useCallback(() => {
    setSnapshot(viewerRef.current?.snapshot() ?? null)
    setModal('offer')
  }, [])

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="logo">
          <b>Lab</b>Mebel <span>3D-визуализация мебели</span>
        </div>

        {clientMode ? (
          <div className="grow" style={{ paddingLeft: 8 }}>
            <strong>{project.name}</strong>
            {project.client ? <span className="muted small"> · для {project.client}</span> : null}
          </div>
        ) : (
          <>
            <input
              className="title-input"
              value={project.name}
              onChange={(e) => patchProject({ name: e.target.value })}
              placeholder="Название проекта"
            />
            <div className="grow" />
            <button type="button" className="btn" onClick={handleSave}>Сохранить</button>
            <button type="button" className="btn" onClick={downloadPng}>PNG</button>
            <button type="button" className="btn" onClick={openOffer}>КП для клиента</button>
            <button type="button" className="btn primary" onClick={() => setModal('share')}>Ссылка клиенту</button>
          </>
        )}
      </header>

      <div className={`workspace ${clientMode ? 'client' : ''}`}>
        {!clientMode ? (
          <Sidebar
            units={project.units}
            selectedId={selectedId}
            saved={saved}
            onSelect={setSelectedId}
            onAdd={addUnit}
            onApplyPreset={applyPreset}
            onLoadSaved={loadSaved}
            onDeleteSaved={removeSaved}
          />
        ) : null}

        <main className="stage">
          <Viewer
            ref={viewerRef}
            project={project}
            selectedId={clientMode ? null : selectedId}
            options={options}
            onSelect={setSelectedId}
            onMove={handleMove}
          />

          <div className="stage-overlay top-left no-print">
            {CAMERA_BUTTONS.map((btn) => (
              <button key={btn.id} type="button" className="pill" onClick={() => viewerRef.current?.focus(btn.id)}>
                {btn.label}
              </button>
            ))}
          </div>

          <div className="stage-overlay bottom-left no-print">
            <button
              type="button"
              className={`pill ${options.openFronts ? 'on' : ''}`}
              onClick={() => setOptions((o) => ({ ...o, openFronts: !o.openFronts }))}
            >
              Открыть фасады
            </button>
            <button
              type="button"
              className={`pill ${options.showRoom ? 'on' : ''}`}
              onClick={() => setOptions((o) => ({ ...o, showRoom: !o.showRoom }))}
            >
              Комната
            </button>
            {!clientMode ? (
              <button
                type="button"
                className={`pill ${options.showDimensions ? 'on' : ''}`}
                onClick={() => setOptions((o) => ({ ...o, showDimensions: !o.showDimensions }))}
              >
                Размеры
              </button>
            ) : null}
            <button
              type="button"
              className={`pill ${options.realistic ? 'on' : ''}`}
              title="Мягкие тени в стыках и сглаживание. Выключите, если сцена подтормаживает."
              onClick={() => setOptions((o) => ({ ...o, realistic: !o.realistic }))}
            >
              Реализм
            </button>
          </div>

          <div className="vignette" aria-hidden="true" />

          <div className="hint no-print">
            {clientMode
              ? 'Вращение — мышью, приближение — колесом'
              : 'ЛКМ — выбрать модуль, перетаскиванием — двигать по полу'}
          </div>
        </main>

        <aside className="pane right">
          {clientMode ? (
            <>
              <div className="pane-section">
                <h4 className="pane-title">Ваш проект</h4>
                <div className="total-box">
                  <div className="caption">Стоимость под ключ</div>
                  <div className="value">{formatMoney(estimate.total, project.pricing.currency)}</div>
                </div>
              </div>
              <div className="pane-section">
                <h4 className="pane-title">Состав</h4>
                <table className="data">
                  <tbody>
                    {project.units.map((unit) => (
                      <tr key={unit.id}>
                        <td>
                          {unit.name}
                          <div className="small muted">{unit.width}×{unit.height}×{unit.depth} мм</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pane-section">
                <h4 className="pane-title">Кто делает</h4>
                <div className="stack small">
                  <div><strong>{project.company.name}</strong></div>
                  {project.company.phone ? <div className="muted">{project.company.phone}</div> : null}
                  {project.company.site ? <div className="muted">{project.company.site}</div> : null}
                  {project.company.manager ? <div className="muted">Менеджер: {project.company.manager}</div> : null}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="tabs">
                <button type="button" className={tab === 'unit' ? 'on' : ''} onClick={() => setTab('unit')}>Изделие</button>
                <button type="button" className={tab === 'estimate' ? 'on' : ''} onClick={() => setTab('estimate')}>Смета</button>
                <button type="button" className={tab === 'project' ? 'on' : ''} onClick={() => setTab('project')}>Проект</button>
              </div>

              {tab === 'unit' ? (
                selectedUnit ? (
                  <UnitEditor
                    unit={selectedUnit}
                    pricing={project.pricing}
                    onChange={(patch) => patchUnit(selectedUnit.id, patch)}
                    onDuplicate={duplicateUnit}
                    onRemove={removeUnit}
                  />
                ) : (
                  <div className="empty">Выберите модуль в списке слева или в 3D.</div>
                )
              ) : null}

              {tab === 'estimate' ? <EstimatePanel project={project} clientMode={false} /> : null}
              {tab === 'project' ? <ProjectPanel project={project} onChange={patchProject} /> : null}
            </>
          )}
        </aside>
      </div>

      {modal === 'share' ? <ShareModal project={project} onClose={() => setModal(null)} /> : null}
      {modal === 'offer' ? <OfferModal project={project} snapshot={snapshot} onClose={() => setModal(null)} /> : null}
      {toast ? <div className="toast no-print">{toast}</div> : null}
    </div>
  )
}
